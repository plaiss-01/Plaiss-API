import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Checking Awin Pipeline Tables ===\n');

  const tables = [
    'AWIN_AFFILIAT_PRODUCTS_DATA_RAW',
    'AWIN_AFFILIAT_PRODUCTS_DATA_DEV',
    'AWIN_AFFILIAT_PRODUCTS_DATA_PROD'
  ];

  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM "${table}"
      `);
      console.log(`Table "${table}": exists with ${(result as any[])[0].count} rows.`);
    } catch (err: any) {
      console.error(`Table "${table}" CHECK FAILED: ${err.message}`);
    }
  }

  // Check Category table as well
  try {
    const catCount = await prisma.category.count();
    console.log(`Table "Category": exists with ${catCount} rows.`);
  } catch (err: any) {
    console.error(`Table "Category" CHECK FAILED: ${err.message}`);
  }

  // Check ProductColorVariant table
  try {
    const varCount = await prisma.productColorVariant.count();
    console.log(`Table "ProductColorVariant": exists with ${varCount} rows.`);
  } catch (err: any) {
    console.error(`Table "ProductColorVariant" CHECK FAILED: ${err.message}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
