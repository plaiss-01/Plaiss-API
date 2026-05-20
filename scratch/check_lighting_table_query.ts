import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { CategoryService } from '../src/category/category.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const categoryService = app.get(CategoryService);

  const category = 'Lighting';
  const types = 'Table';

  const { data: allCats, categoryMap, childrenMap } = await categoryService.getCategoryStructure();

  const targetCats = allCats.filter(c =>
    c.slug.toLowerCase() === category.toLowerCase() ||
    c.name.toLowerCase() === category.toLowerCase()
  );

  const getDescendantIds = (catId: string, visited = new Set<string>()): string[] => {
    if (visited.has(catId)) return [];
    visited.add(catId);
    let ids = [catId];
    const children = childrenMap.get(catId) || [];
    for (const child of children) {
      ids = ids.concat(getDescendantIds(child.id, visited));
    }
    return ids;
  };

  const allCategoryIds: string[] = [];
  const allCategoryNames: string[] = [];

  for (const cat of targetCats) {
    const children = childrenMap.get(cat.id) || [];
    if (children.length > 0) {
      for (const child of children) {
        const descendantIds = getDescendantIds(child.id);
        allCategoryIds.push(...descendantIds);
      }
    } else {
      allCategoryIds.push(cat.id);
      allCategoryNames.push(cat.name);
      allCategoryNames.push(cat.name.toLowerCase().trim());
    }
  }

  let uniqueIds = Array.from(new Set(allCategoryIds));
  let uniqueNames = Array.from(new Set(allCategoryNames));

  if (!uniqueNames.some(n => n.toLowerCase() === category.toLowerCase())) {
    uniqueNames.push(category);
  }

  const where: any = {};
  where.OR = [
    { categoryId: { in: uniqueIds } },
    {
      OR: uniqueNames.map((name) => ({
        category: { contains: name, mode: 'insensitive' as const },
      })),
    },
    {
      OR: uniqueNames.map((name) => ({
        merchantCategory: { contains: name, mode: 'insensitive' as const },
      })),
    },
  ];

  const array = types.replace(/\+/g, ' ').split(',').map(s => s.trim());
  where.AND = [
    {
      OR: array.flatMap(val => [
        { productType: { contains: val, mode: 'insensitive' as const } },
        { category: { contains: val, mode: 'insensitive' as const } }
      ])
    }
  ];

  const products = await prisma.product.findMany({
    where,
    select: {
      name: true,
      merchant: true,
      category: true,
      categoryId: true,
      merchantCategory: true,
      productType: true
    },
    take: 10
  });

  console.log(`Found ${products.length} products`);
  if (products.length > 0) {
    console.table(products.map((p: any) => ({
      name: p.name.substring(0, 30),
      merchant: p.merchant,
      category: p.category,
      categoryId: p.categoryId,
      productType: p.productType
    })));
  }

  await app.close();
}

bootstrap().catch(console.error);
