import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not defined');

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function getCategoryTerms(name: string): string[] {
  const terms = [name];
  const lower = name.toLowerCase();
  
  if (lower.endsWith('ies')) {
    terms.push(name.slice(0, -3) + 'y');
  } else if (lower.endsWith('es') && (lower.endsWith('ches') || lower.endsWith('shes') || lower.endsWith('xes'))) {
    terms.push(name.slice(0, -2));
  } else if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('as')) {
    terms.push(name.slice(0, -1));
  }
  
  if (lower.endsWith('y') && !lower.endsWith('ey') && !lower.endsWith('ay') && !lower.endsWith('oy') && !lower.endsWith('uy')) {
    terms.push(name.slice(0, -1) + 'ies');
  } else if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x')) {
    terms.push(name + 'es');
  } else if (!lower.endsWith('s')) {
    terms.push(name + 's');
  }

  return Array.from(new Set(terms));
}

async function test() {
  // Query categories
  const allCats = await prisma.category.findMany({
    include: { children: true, parent: true }
  });
  
  const categoryMap = new Map();
  const childrenMap = new Map();
  allCats.forEach(cat => {
    categoryMap.set(cat.id, cat);
    if (cat.parentId) {
      const children = childrenMap.get(cat.parentId) || [];
      children.push(cat);
      childrenMap.set(cat.parentId, children);
    }
  });

  const category = 'furnitures';
  const targetCats = allCats.filter(c =>
    c.slug.toLowerCase() === category.toLowerCase() ||
    c.name.toLowerCase() === category.toLowerCase()
  );

  console.log('Target categories found:', targetCats.map(c => ({ id: c.id, name: c.name, slug: c.slug })));

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
        allCategoryNames.push(...getCategoryTerms(child.name));
      }
    } else {
      allCategoryIds.push(cat.id);
      allCategoryNames.push(...getCategoryTerms(cat.name));
    }
  }

  const uniqueIds = Array.from(new Set(allCategoryIds));
  const uniqueNames = Array.from(new Set(allCategoryNames));

  console.log('uniqueIds:', uniqueIds);
  console.log('uniqueNames:', uniqueNames);

  const where: any = {
    imageUrl: { not: null },
    NOT: { imageUrl: '' },
    OR: [
      { categoryRel: { id: { in: uniqueIds } } },
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
    ]
  };

  const count = await prisma.product.count({ where });
  console.log('Count matching this query:', count);

  // Let's print 5 sample matching products
  const products = await prisma.product.findMany({
    where,
    take: 5,
    select: { id: true, name: true, category: true, merchantCategory: true }
  });
  console.log('Sample products matching:', products);
}

test().catch(console.error).finally(() => prisma.$disconnect());
