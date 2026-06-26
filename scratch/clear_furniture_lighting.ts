import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Preparing to Clear Furniture & Lighting Products ===\n');

  const tableName = '"AWIN_AFFILIAT_PRODUCTS_DATA_PROD"';

  // 1. Count products to delete
  const productsToDelete = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as count 
    FROM ${tableName}
    WHERE "category_name" IS NULL OR "category_name" != 'Artificial Plants'
  `);
  const prodDeleteCount = (productsToDelete as any[])[0].count;

  // 2. Count variants to delete
  const variantsToDelete = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as count 
    FROM "ProductColorVariant" v
    JOIN ${tableName} p ON v."product_id" = p."aw_product_id"
    WHERE p."category_name" IS NULL OR p."category_name" != 'Artificial Plants'
  `);
  const varDeleteCount = (variantsToDelete as any[])[0].count;

  console.log(`Products to delete (not 'Artificial Plants'): ${prodDeleteCount}`);
  console.log(`Color variants to delete: ${varDeleteCount}`);

  if (prodDeleteCount === 0) {
    console.log('No products to delete. Exiting.');
    return;
  }

  // 3. Delete from ProductColorVariant first (foreign key constraint)
  console.log('\nDeleting associated color variants...');
  const delVars = await prisma.$queryRawUnsafe(`
    DELETE FROM "ProductColorVariant"
    WHERE "product_id" IN (
      SELECT "aw_product_id" 
      FROM ${tableName}
      WHERE "category_name" IS NULL OR "category_name" != 'Artificial Plants'
    )
  `);
  console.log(`Deleted variants successfully.`);

  // 4. Delete from AWIN_AFFILIAT_PRODUCTS_DATA_PROD
  console.log('Deleting products...');
  const delProds = await prisma.$queryRawUnsafe(`
    DELETE FROM ${tableName}
    WHERE "category_name" IS NULL OR "category_name" != 'Artificial Plants'
  `);
  console.log(`Deleted products successfully.`);

  // 5. Verify final counts
  const finalProds = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM ${tableName}`);
  const finalVars = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "ProductColorVariant"`);

  console.log('\n=== Verification After Deletion ===');
  console.log(`Remaining products in database: ${(finalProds as any[])[0].count}`);
  console.log(`Remaining variants in database: ${(finalVars as any[])[0].count}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
