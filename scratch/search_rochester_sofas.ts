import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Searching for Specific Sofa Series ===\n');

  const names = ['Rochester Leather', 'Parker Faux', 'Warth Fabric', 'Radford Leather', 'Neci Leather'];

  for (const name of names) {
    const products = await prisma.$queryRawUnsafe(`
      SELECT "aw_product_id" as id, "product_name" as name, "brand_name", "merchant_name", "colour"
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE "product_name" ILIKE $1
    `, `%${name}%`);
    
    console.log(`\nProducts matching "${name}":`);
    console.table(products);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
