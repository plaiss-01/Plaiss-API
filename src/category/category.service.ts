import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; parentId?: string; isAwin?: boolean }) {
    try {
      return await (this.prisma as any).category.create({
        data,
        include: { children: true, parent: true },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Category with this name already exists');
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

  async update(id: string, data: { name?: string; parentId?: string | null }) {
    return (this.prisma as any).category.update({
      where: { id },
      data,
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
      const existing = await (this.prisma as any).category.findUnique({
        where: { name },
      });
      if (!existing) {
        const cat = await (this.prisma as any).category.create({
          data: { name, isAwin: true },
        });
        created.push(cat);
      } else if (!existing.isAwin) {
        // If it exists but wasn't marked as Awin, mark it
        await (this.prisma as any).category.update({
          where: { id: existing.id },
          data: { isAwin: true },
        });
      }
    }

    return {
      message: `Synced ${awinCategoryNames.length} categories from Awin`,
      newlyCreated: created.length,
    };
  }
}
