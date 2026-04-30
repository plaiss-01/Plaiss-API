import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  private categoriesCache: { data: any[], timestamp: number } | null = null;
  private readonly CACHE_TTL = 60000;

  clearCache() {
    this.categoriesCache = null;
  }

  private slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(data: { name: string; parentId?: string; isAwin?: boolean }) {
    const rawName = data.name;
    const parts = rawName.split(/\s*[>|]\s*|\s*&gt;\s*/).map(p => p.trim()).filter(Boolean);

    if (parts.length > 1) {
      let currentParentId = data.parentId || null;
      let lastCreated: any = null;

      for (const part of parts) {
        const slug = this.slugify(part);

        // Find existing or create
        let category = await (this.prisma as any).category.findFirst({
          where: { OR: [{ slug }, { name: { equals: part, mode: 'insensitive' } }] }
        });

        if (!category) {
          category = await (this.prisma as any).category.create({
            data: {
              name: part,
              slug,
              parentId: currentParentId,
              isAwin: data.isAwin || false,
            },
            include: { children: true, parent: true }
          });
        }


        currentParentId = category.id;
        lastCreated = category;
      }
      return lastCreated;
    }

    // Normal single category creation
    try {
      const slug = this.slugify(data.name);

      const existing = await (this.prisma as any).category.findFirst({
        where: {
          OR: [
            { slug },
            { name: { equals: data.name, mode: 'insensitive' } }
          ]
        }
      });

      if (existing) {
        const updateData: any = {};
        let needsUpdate = false;

        // Only flip isAwin to false if we are explicitly creating a manual category
        // and the existing one was an Awin category.
        if (existing.isAwin && data.isAwin !== true) {
          updateData.isAwin = false;
          needsUpdate = true;
        }

        const requestedParentId = data.parentId || null;
        if (existing.parentId !== requestedParentId) {
          updateData.parentId = requestedParentId;
          needsUpdate = true;
        }

        if (needsUpdate) {
          this.clearCache();
          return await (this.prisma as any).category.update({
            where: { id: existing.id },
            data: updateData,
            include: { children: true, parent: true }
          });
        }
        return existing;
      }

      const createData: any = {
        name: data.name,
        slug,
        isAwin: data.isAwin || false,
      };

      if (data.parentId && data.parentId !== '') {
        createData.parentId = data.parentId;
      }

      this.clearCache();
      return await (this.prisma as any).category.create({
        data: createData,
        include: { children: true, parent: true },
      });
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    const now = Date.now();
    if (this.categoriesCache && (now - this.categoriesCache.timestamp < this.CACHE_TTL)) {
      return this.categoriesCache.data;
    }

    const data = await (this.prisma as any).category.findMany({
      include: {
        children: true,
        parent: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    this.categoriesCache = { data, timestamp: now };
    return data;
  }

  async findRoots() {
    return (this.prisma as any).category.findMany({
      where: { parentId: null, isAwin: false },
      include: {
        children: {
          include: {
            children: true,
            parent: true,
          },
        },
        parent: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async reorder(orders: { id: string; order: number }[]) {
    this.clearCache();
    const updates = orders.map((item) =>
      (this.prisma as any).category.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );
    return Promise.all(updates);
  }

  async bulkLink(ids: string[], parentId: string) {
    this.clearCache();

    // 1. Get the target parent
    const parent = await (this.prisma as any).category.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Parent category not found');

    // 2. Get names of categories being merged
    const mergedCats = await (this.prisma as any).category.findMany({
      where: { id: { in: ids } },
      select: { name: true, isAwin: true }
    });
    const mergedNames = mergedCats.map(c => c.name);
    const awinNamesToMerge = mergedCats.filter(c => c.isAwin).map(c => c.name);

    // 3. Perform the link
    const result = await (this.prisma as any).category.updateMany({
      where: { id: { in: ids } },
      data: { parentId, isAwin: false },
    });

    // 4. If target parent is Manual, merge products from AWIN categories into it
    if (!parent.isAwin && awinNamesToMerge.length > 0) {
      await this.prisma.product.updateMany({
        where: {
          OR: [
            { category: { in: awinNamesToMerge } },
            { merchantCategory: { in: awinNamesToMerge } }
          ]
        },
        data: { category: parent.name }
      });
    }

    return result;
  }



  async findOne(id: string) {
    const category = await (this.prisma as any).category.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async findBySlug(slug: string) {
    const category = await (this.prisma as any).category.findUnique({
      where: { slug },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, data: { name?: string; parentId?: string | null }) {
    const updateData: any = { ...data, isAwin: false };
    if (data.name) {
      updateData.slug = this.slugify(data.name);
    }

    this.clearCache();

    // If we are linking to a parent, handle product merging
    if (data.parentId) {
      const [category, parent] = await Promise.all([
        (this.prisma as any).category.findUnique({ where: { id } }),
        (this.prisma as any).category.findUnique({ where: { id: data.parentId } })
      ]);

      if (category && category.isAwin && parent && !parent.isAwin) {
        await this.prisma.product.updateMany({
          where: {
            OR: [
              { category: category.name },
              { merchantCategory: category.name }
            ]
          },
          data: { category: parent.name }
        });
      }
    }

    return (this.prisma as any).category.update({
      where: { id },
      data: updateData,
      include: { children: true, parent: true },
    });
  }

  async remove(id: string) {
    this.clearCache();
    return (this.prisma as any).category.delete({
      where: { id }
    });
  }

  async removeAll() {
    this.clearCache();
    return (this.prisma as any).category.deleteMany({});
  }

  async syncAwinCategories() {
    // 1. Get unique categories from Product table
    const products = await this.prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });

    const awinCategoryNames = products
      .map((p) => p.category?.trim())
      .filter((name): name is string => !!name && name !== '');

    const created: any[] = [];

    // 2. Create Category records for each (if they don't exist)
    for (const name of awinCategoryNames) {
      const slug = this.slugify(name);
      const existing = await (this.prisma as any).category.findFirst({
        where: { OR: [{ name }, { slug }] },
      });
      if (!existing) {
        const cat = await (this.prisma as any).category.create({
          data: { name, slug, isAwin: true },
        });
        created.push(cat);
      } else {
        const updateData: any = {};
        let needsUpdate = false;

        // If it exists but is NOT yet marked as Awin, and it's a root category 
        // (no parent), we can safely mark it as Awin so it moves to the 
        // sub-item management pool instead of the main list.
        if (!existing.isAwin && !existing.parentId) {
          updateData.isAwin = true;
          needsUpdate = true;
        }

        if (!existing.slug) {
          updateData.slug = slug;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await (this.prisma as any).category.update({
            where: { id: existing.id },
            data: updateData,
          });
        }
      }
    }

    this.clearCache();
    return {
      message: `Synced ${awinCategoryNames.length} categories from Awin`,
      newlyCreated: created.length,
    };
  }
}
