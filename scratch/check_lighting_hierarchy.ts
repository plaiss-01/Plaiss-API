import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CategoryService } from '../src/category/category.service';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const categoryService = app.get(CategoryService);
  const prisma = app.get(PrismaService);

  const { data: allCats, categoryMap, childrenMap } = await categoryService.getCategoryStructure();

  // Find 'lighting' category
  const targetCats = allCats.filter(c =>
    c.slug.toLowerCase() === 'lighting' ||
    c.name.toLowerCase() === 'lighting'
  );

  console.log(`Found target categories:`, targetCats.map(c => c.name));

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
  
  if (!uniqueNames.some(n => n.toLowerCase() === 'lighting')) {
    uniqueNames.push('Lighting');
  }

  console.log(`Querying DB with IDs: ${uniqueIds.length}, Names: ${uniqueNames.length}`);

  const products = await prisma.product.groupBy({
    by: ['merchant'],
    where: {
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
    _count: {
      id: true
    }
  });

  console.log(`\nRetailers for the lighting hierarchy:`);
  console.table(products.map(p => ({ Merchant: p.merchant, Count: p._count.id })));

  await app.close();
}

bootstrap().catch(console.error);
