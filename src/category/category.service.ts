import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(data: { name: string; parentId?: string; isAwin?: boolean }) {
    try {
      const slug = this.slugify(data.name);
      return await (this.prisma as any).category.create({
        data: { ...data, slug },
        include: { children: true, parent: true },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Category with this name or slug already exists');
      }
      throw error;
    }
  }

  async findAll() {
    return (this.prisma as any).category.findMany({
      include: {
        children: true,
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
    return (this.prisma as any).category.update({
      where: { id },
      data: updateData,
      include: { children: true, parent: true },
    });
  }

  async remove(id: string) {
    return (this.prisma as any).category.delete({ where: { id } });
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

    return {
      message: `Synced ${awinCategoryNames.length} categories from Awin`,
      newlyCreated: created.length,
    };
  }
}
