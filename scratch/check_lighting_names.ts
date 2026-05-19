import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CategoryService } from '../src/category/category.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const categoryService = app.get(CategoryService);

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

  const allCategoryNames: string[] = [];

  for (const cat of targetCats) {
    const children = childrenMap.get(cat.id) || [];
    if (children.length > 0) {
      for (const child of children) {
        const descendantIds = getDescendantIds(child.id);
        descendantIds.forEach(id => {
          const c = categoryMap.get(id);
          if (c) {
            allCategoryNames.push(c.name);
          }
        });
      }
    } else {
      allCategoryNames.push(cat.name);
    }
  }
  
  let uniqueNames = Array.from(new Set(allCategoryNames));
  console.log("Lighting Category Descendant Names:");
  console.log(uniqueNames.join(", "));

  await app.close();
}

bootstrap().catch(console.error);
