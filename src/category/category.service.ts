import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  private static categoriesCache: { 
    data: any[], 
    categoryMap: Map<string, any>, 
    childrenMap: Map<string, any[]>,
    timestamp: number 
  } | null = null;
  private readonly CACHE_TTL = 30000; // 30 seconds for category structure

  async getCategoryStructure() {
    const now = Date.now();
    if (!CategoryService.categoriesCache || now - CategoryService.categoriesCache.timestamp > this.CACHE_TTL) {
      const allCats = await this.findAll();
      const categoryMap = new Map<string, any>();
      const childrenMap = new Map<string, any[]>();
      allCats.forEach(cat => {
        categoryMap.set(cat.id, cat);
        if (cat.parentId) {
          const children = childrenMap.get(cat.parentId) || [];
          children.push(cat);
          childrenMap.set(cat.parentId, children);
        }
      });
      CategoryService.categoriesCache = { data: allCats, categoryMap, childrenMap, timestamp: now };
    }
    return CategoryService.categoriesCache;
  }

  // Cache removed: with multiple EKS pods, per-pod caches cause stale data bugs.
  // UPDATE: We keep a short-lived static cache for performance on heavy requests.
  clearCache() {
    CategoryService.categoriesCache = null;
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
    const slug = this.slugify(data.name);
    
    // Check if category already exists by name or slug
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: data.name },
          { slug: slug }
        ]
      },
    });
    if (existing) {
      throw new ConflictException(`Category with name "${data.name}" or slug "${slug}" already exists.`);
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        isAwin: data.isAwin !== undefined ? data.isAwin : false, // Default to false for manual
        parentId: data.parentId || null,
      },
      include: {
        children: true,
        parent: true,
      },
    });
  }

  async findAll(isAwin?: boolean, search?: string, limit: number = 500, parentId?: string | null) {
    const where: any = {};
    if (isAwin !== undefined) {
      where.isAwin = isAwin;
    }
    if (parentId !== undefined) {
      where.parentId = parentId === 'null' ? null : parentId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        isAwin: true,
        parentId: true,
        children: { select: { id: true, name: true, slug: true, parentId: true } },
        parent: { select: { id: true, name: true, slug: true } },
      },
      take: limit > 0 ? limit : 500,
      orderBy: { name: 'asc' },
    });
  }

  async findRoots() {
    return this.findAll(false);
  }

  async reorder(orders: { id: string; order: number }[]) {
    return [];
  }

  async bulkLink(ids: string[], parentId: string) {
    return { count: 0 };
  }

  async findOne(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        parent: true,
      },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async findBySlug(slug: string) {
    const cat = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: true,
        parent: true,
      },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, data: any) {
    const updateData: any = {};
    
    const currentCategory = await this.prisma.category.findUnique({ where: { id } });
    if (!currentCategory) throw new NotFoundException('Category not found');
    
    if (data.name && data.name !== currentCategory.name) {
      const slug = this.slugify(data.name);
      
      // Check if another category already has this name or slug
      const existing = await this.prisma.category.findFirst({
        where: {
          OR: [
            { name: data.name },
            { slug: slug }
          ],
          NOT: { id }
        }
      });
      
      if (existing) {
        throw new ConflictException(`Category with name "${data.name}" or slug "${slug}" already exists.`);
      }

      updateData.name = data.name;
      updateData.slug = slug;
      
      // Also update products if needed
      await this.prisma.product.updateMany({
        where: { category: { equals: currentCategory.name, mode: 'insensitive' } },
        data: { category: data.name },
      });
    }
    
    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId === 'null' ? null : data.parentId;
    }

    if (Object.keys(updateData).length === 0) {
      return { id, success: true, message: 'No changes made' };
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    this.clearCache();
    return { ...updated, success: true };
  }

  async remove(id: string) {
    const currentCategory = await this.prisma.category.findUnique({ where: { id } });
    
    if (currentCategory) {
      // Unlink products from this category to avoid relation violation
      await this.prisma.product.updateMany({
        where: { category: { equals: currentCategory.name, mode: 'insensitive' } },
        data: { category: null },
      });
    }
 
    // First, set parentId to null for any children to avoid breaking relations
    await this.prisma.category.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });
 
    const deleted = await this.prisma.category.delete({
      where: { id },
    });

    this.clearCache();
    return deleted;
  }

  async removeAll() {
    this.clearCache();
    return { count: 0 };
  }

  async syncAwinCategories() {
    const products = await this.prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });

    let newlyCreated = 0;
    for (const { category } of products) {
      if (!category) continue;
      const slug = this.slugify(category);
      await this.prisma.category.upsert({
        where: { slug },
        update: {},
        create: { name: category, slug, isAwin: true },
      });
      newlyCreated++;
    }

    this.clearCache();
    return {
      message: `Found ${products.length} unique categories in products`,
      newlyCreated,
    };
  }
}
