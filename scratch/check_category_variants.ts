import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Checking Product & Variant Merges Across All Categories ===\n');

  // Query to get product and variant counts grouped by category
  const stats = await prisma.$queryRawUnsafe(`
    SELECT 
      COALESCE(p."category_name", 'Uncategorized') as category,
      COUNT(DISTINCT p."aw_product_id")::int as active_products,
      COUNT(DISTINCT v."id")::int as merged_variants
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p
    LEFT JOIN "ProductColorVariant" v ON v."product_id" = p."aw_product_id"
    GROUP BY p."category_name"
    ORDER BY active_products DESC
  `);

  console.log('Category Merge Statistics:');
  console.table(stats);

  // Summarize overall merge totals
  const overall = await prisma.$queryRawUnsafe(`
    SELECT 
      (SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD")::int as total_active_products,
      (SELECT COUNT(*) FROM "ProductColorVariant")::int as total_merged_variants,
      (SELECT COUNT(DISTINCT "product_id") FROM "ProductColorVariant")::int as parent_products_with_variants
  `);
  
  const { total_active_products, total_merged_variants, parent_products_with_variants } = (overall as any[])[0];
  console.log('\n--- Overall Summary ---');
  console.log(`Total Active Products in Database: ${total_active_products}`);
  console.log(`Total Merged Color Variants: ${total_merged_variants}`);
  console.log(`Parent Products with Variants: ${parent_products_with_variants}`);
  console.log(`Average Variants per Parent Product: ${(total_merged_variants / (parent_products_with_variants || 1)).toFixed(2)}`);
  console.log(`Percentage of catalog items converted to variants: ${((total_merged_variants / (total_active_products + total_merged_variants)) * 100).toFixed(2)}%`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
