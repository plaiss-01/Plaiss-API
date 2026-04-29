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
              isDeleted: false,
            },
            include: { children: true, parent: true }
          });
        } else if (category.isDeleted) {
          // If it was deleted, reactivate it if it's being created/synced again?
          // Actually, let's keep it deleted if it was manually deleted.
          // Or maybe we should reactivate it? 
          // The user said "those categories i deleted ... will sync again".
          // So we should NOT reactivate them during sync.
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

        if (existing.isDeleted || existing.isAwin) {
          updateData.isDeleted = false;
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

  async findAll(includeDeleted = false) {
    const now = Date.now();
    if (!includeDeleted && this.categoriesCache && (now - this.categoriesCache.timestamp < this.CACHE_TTL)) {
      return this.categoriesCache.data;
    }

    const where: any = {};
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    const data = await (this.prisma as any).category.findMany({
      where,
      include: {
        children: {
          where: includeDeleted ? {} : { isDeleted: false }
        },
        parent: true,
      },
      orderBy: { name: 'asc' },
    });

    if (!includeDeleted) {
      this.categoriesCache = { data, timestamp: now };
    }
    return data;
  }

  async findRoots() {
    return (this.prisma as any).category.findMany({
      where: { parentId: null, isDeleted: false, isAwin: false },
      include: {
        children: {
          where: { isDeleted: false },
          include: {
            children: {
              where: { isDeleted: false }
            },
            parent: true,
          },
        },
        parent: true,
      },
      orderBy: { name: 'asc' },
    });
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
    const updateData: any = { ...data };
    if (data.name) {
      updateData.slug = this.slugify(data.name);
    }
    this.clearCache();
    return (this.prisma as any).category.update({
      where: { id },
      data: updateData,
      include: { children: true, parent: true },
    });
  }

  async remove(id: string) {
    this.clearCache();
    return (this.prisma as any).category.update({
      where: { id },
      data: { isDeleted: true }
    });
  }

  async restore(id: string) {
    this.clearCache();
    return (this.prisma as any).category.update({
      where: { id },
      data: { isDeleted: false }
    });
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
          data: { name, slug, isAwin: true, isDeleted: false },
        });
        created.push(cat);
      } else if (!existing.isDeleted) {
        const updateData: any = { isAwin: true };
        if (!existing.slug) {
          updateData.slug = slug;
        }
        await (this.prisma as any).category.update({
          where: { id: existing.id },
          data: updateData,
        });
      }
    }

    this.clearCache();
    return {
      message: `Synced ${awinCategoryNames.length} categories from Awin`,
      newlyCreated: created.length,
    };
  }
}
