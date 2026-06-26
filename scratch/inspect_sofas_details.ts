import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Inspecting Sofa/Furniture Product Categories ---');

  // Let's find products that match sofa or furniture
  const products = await prisma.$queryRawUnsafe(`
    SELECT "aw_product_id" as id, "product_name" as name, "category_name", "merchant_category", "category_id"
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "category_name" ~* 'sofa|furniture|chair|table' 
       OR "merchant_category" ~* 'sofa|furniture|chair|table'
    LIMIT 20
  `);

  console.log(`Matching products found: ${(products as any[]).length}`);
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
