import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  // Cache removed: with multiple EKS pods, per-pod caches cause stale data bugs.
  clearCache() {
    // no-op — kept for call-site compatibility
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
        } else {
          // If it exists but was an Awin category, and we are now manually creating/using it,
          // flip it to a manual category so it shows in the UI.
          if (category.isAwin && data.isAwin !== true) {
            category = await (this.prisma as any).category.update({
              where: { id: category.id },
              data: { isAwin: false },
              include: { children: true, parent: true }
            });
          }
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

  async findAll(isAwin?: boolean, search?: string, limit: number = 1000) {
    const where: any = {};
    if (isAwin !== undefined) {
      where.isAwin = isAwin;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    return (this.prisma as any).category.findMany({
      where,
      include: {
        children: true,
        parent: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      take: limit, // Prevent massive memory consumption
    });
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

  async update(id: string, data: any) {
    this.clearCache();

    try {
      console.log(`[CategoryService] Updating category ${id}`, data);
      
      // 1. Verify the category exists first to avoid P2025
      const currentCategory = await (this.prisma as any).category.findUnique({
        where: { id },
      });

      if (!currentCategory) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // Handle isMerged flag
      if (data.isMerged !== undefined) {
        const boolVal = data.isMerged === true || data.isMerged === 'true';
        await (this.prisma as any).category.update({
          where: { id },
          data: { isMerged: boolVal }
        });
      }

      if (data.name || data.parentId !== undefined) {
        const prismaUpdate: any = {};
        
        if (data.name && data.name !== currentCategory.name) {
          const newName = data.name;
          const newSlug = this.slugify(newName);

          // Check if another category already has this name or slug
          const existing = await (this.prisma as any).category.findFirst({
            where: {
              OR: [{ name: newName }, { slug: newSlug }],
              NOT: { id: id }
            }
          });

          if (existing) {
            // MERGE LOGIC: If renaming to an existing category, move children and products
            console.log(`Merging category "${currentCategory.name}" into existing category "${existing.name}"`);
            
            // Move children
            await (this.prisma as any).category.updateMany({
              where: { parentId: id },
              data: { parentId: existing.id }
            });

            // Update products that reference this category name
            await this.prisma.product.updateMany({
              where: {
                OR: [
                  { category: currentCategory.name },
                  { merchantCategory: currentCategory.name }
                ]
              },
              data: { category: existing.name }
            });

            // Delete the "duplicate" category
            await (this.prisma as any).category.delete({
              where: { id }
            });

            // IMPORTANT: If merging into an Awin category, flip it to manual so it stays visible
            if (existing.isAwin) {
              await (this.prisma as any).category.update({
                where: { id: existing.id },
                data: { isAwin: false }
              });
            }

            return { id: existing.id, merged: true, success: true };
          }

          prismaUpdate.name = newName;
          prismaUpdate.slug = newSlug;
          prismaUpdate.isAwin = false;
        }

        if (data.parentId !== undefined) {
          prismaUpdate.parentId = data.parentId;
        }

        if (Object.keys(prismaUpdate).length > 0) {
          await (this.prisma as any).category.update({
            where: { id },
            data: prismaUpdate,
          });
        }
      }

      return { id, success: true };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('A category with this name or slug already exists');
      }
      console.error('Category update error:', error);
      throw error;
    }
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

        // We should NEVER overwrite a manual category (isAwin: false) 
        // to become an Awin category during sync. Manual takes precedence.

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
