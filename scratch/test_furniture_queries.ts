import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const allCats = await prisma.category.findMany();
  console.log("All categories in DB:");
  console.log(allCats.map(c => ({ id: c.id, name: c.name, parentId: c.parentId })));

  // Test Sofa Count
  const sofaCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'sofas', mode: 'insensitive' } },
        { merchantCategory: { contains: 'sofas', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`\nProducts matching 'sofas': ${sofaCount}`);

  // Test Chair Count
  const chairCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'chairs', mode: 'insensitive' } },
        { merchantCategory: { contains: 'chairs', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'chairs': ${chairCount}`);

  // Test Tables Count
  const tableCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'tables', mode: 'insensitive' } },
        { merchantCategory: { contains: 'tables', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'tables': ${tableCount}`);

  // Test Table (singular) Count
  const tableSingularCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'table', mode: 'insensitive' } },
        { merchantCategory: { contains: 'table', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'table' (singular): ${tableSingularCount}`);

  // Test Furniture (singular) Count
  const furnitureSingularCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'furniture', mode: 'insensitive' } },
        { merchantCategory: { contains: 'furniture', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'furniture' (singular): ${furnitureSingularCount}`);
}

test().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
