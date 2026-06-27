import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL must be defined in .env');
}

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Searching for artificial plant products in the database...');

  // Find products matching the criteria
  const productsToDelete = await prisma.$queryRawUnsafe<any[]>(`
    SELECT aw_product_id, product_name, category_name, merchant_category 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE (product_name ILIKE '%plant%' OR category_name ILIKE '%plant%' OR merchant_category ILIKE '%plant%')
      AND product_name ILIKE '%artificial%';
  `);

  console.log(`Found ${productsToDelete.length} artificial plant products to delete.`);

  if (productsToDelete.length > 0) {
    const ids = productsToDelete.map((p) => p.aw_product_id);

    // Delete related ProductColorVariant records first (to respect relation constraints)
    const deletedVariants = await prisma.$executeRawUnsafe(`
      DELETE FROM "ProductColorVariant"
      WHERE product_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')});
    `, ...ids);
    console.log(`Deleted ${deletedVariants} related ProductColorVariant records.`);

    // Delete related HomepageProduct records if any
    const deletedHomepage = await prisma.$executeRawUnsafe(`
      DELETE FROM "homepage_products"
      WHERE product_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')});
    `, ...ids);
    console.log(`Deleted ${deletedHomepage} related homepage_products records.`);

    // Delete the products from the main PROD table
    const deletedProducts = await prisma.$executeRawUnsafe(`
      DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE aw_product_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')});
    `, ...ids);
    console.log(`Successfully deleted ${deletedProducts} artificial plant products from PROD table.`);
  }

  console.log('Cleanup complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
