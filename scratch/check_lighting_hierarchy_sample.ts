import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CategoryService } from '../src/category/category.service';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const categoryService = app.get(CategoryService);
  const prisma = app.get(PrismaService);

  const { data: allCats, categoryMap, childrenMap } = await categoryService.getCategoryStructure();

  const targetCats = allCats.filter(c =>
    c.slug.toLowerCase() === 'lighting' ||
    c.name.toLowerCase() === 'lighting'
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
        descendantIds.forEach(id => {
          const c = categoryMap.get(id);
          if (c) {
            allCategoryNames.push(c.name);
            allCategoryNames.push(c.name.toLowerCase().trim());
          }
        });
      }
    } else {
      allCategoryIds.push(cat.id);
      allCategoryNames.push(cat.name);
      allCategoryNames.push(cat.name.toLowerCase().trim());
    }
  }
  
  let uniqueIds = Array.from(new Set(allCategoryIds));
  let uniqueNames = Array.from(new Set(allCategoryNames));
  if (!uniqueNames.some(n => n.toLowerCase() === 'lighting')) uniqueNames.push('Lighting');

  const products = await prisma.product.findMany({
    where: {
      merchant: { not: 'Lights.co.uk' },
      OR: [
        { categoryId: { in: uniqueIds } },
        {
          OR: uniqueNames.map(name => ({
            category: { contains: name, mode: 'insensitive' }
          }))
        },
        {
          OR: uniqueNames.map(name => ({
            merchantCategory: { contains: name, mode: 'insensitive' }
          }))
        }
      ]
    },
    select: {
      merchant: true,
      category: true,
      merchantCategory: true,
      name: true
    },
    take: 10
  });

  console.log(`\nSample products from other retailers:`);
  console.table(products);

  await app.close();
}

bootstrap().catch(console.error);
