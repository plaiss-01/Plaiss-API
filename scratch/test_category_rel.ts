import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  // Let's find the 'sofas' category CUID
  const sofasCat = await prisma.category.findUnique({
    where: { name: 'sofas' }
  });
  console.log('sofas category:', sofasCat);

  if (sofasCat) {
    // 1. Query using categoryId field (raw)
    const countById = await prisma.product.count({
      where: { categoryId: sofasCat.id }
    });
    console.log(`Count using categoryId field: ${countById}`);

    // 2. Query using categoryRel relation
    const countByRel = await prisma.product.count({
      where: { categoryRel: { id: sofasCat.id } }
    });
    console.log(`Count using categoryRel relation: ${countByRel}`);
  }

  // Let's find the 'Table' category (under Lighting) CUID
  const tableCat = await prisma.category.findUnique({
    where: { name: 'Table' }
  });
  console.log('\nTable category:', tableCat);

  if (tableCat) {
    const countById = await prisma.product.count({
      where: { categoryId: tableCat.id }
    });
    console.log(`Count using categoryId field: ${countById}`);

    const countByRel = await prisma.product.count({
      where: { categoryRel: { id: tableCat.id } }
    });
    console.log(`Count using categoryRel relation: ${countByRel}`);
  }
}

test().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
