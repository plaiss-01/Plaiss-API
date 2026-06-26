import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.$queryRawUnsafe(`
    SELECT "aw_product_id" as id, "product_name" as name, "brand_name", "merchant_name", "colour", "image_url", "product_url"
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "product_name" = 'EGLO connect Hornwood-Z LED ceiling light, 4-bulb, black'
  `);
  console.log('Duplicate products found:', products);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
