import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const sofaRoot = await prisma.category.findFirst({ where: { name: { equals: 'sofas', mode: 'insensitive' } } });
  if (!sofaRoot) return console.log('Sofa Root Not Found');

  const allCats = await prisma.category.findMany();
  const childrenMap = new Map();
  allCats.forEach(c => {
    if (c.parentId) {
      const children = childrenMap.get(c.parentId) || [];
      children.push(c);
      childrenMap.set(c.parentId, children);
    }
  });

  function getDescendants(id) {
    let ids = [id];
    const children = childrenMap.get(id) || [];
    for (const child of children) {
      ids = ids.concat(getDescendants(child.id));
    }
    return ids;
  }

  const descendantIds = getDescendants(sofaRoot.id);
  console.log(`Sofas Descendant IDs Count: ${descendantIds.length}`);

  const totalProducts = await prisma.product.count({
    where: { internalCategoryId: { in: descendantIds } }
  });

  const rootOnlyProducts = await prisma.product.count({
    where: { internalCategoryId: sofaRoot.id }
  });

  console.log(`Total Combined Products: ${totalProducts}`);
  console.log(`Root Only Products: ${rootOnlyProducts}`);
}

main().finally(() => prisma.$disconnect());
