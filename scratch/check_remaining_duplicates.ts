import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Checking for Remaining Duplicates in Database ---');

  // 1. Check exact name & merchant duplication
  console.log('\nChecking for exact product name and merchant duplication...');
  const exactDuplicates = await prisma.$queryRawUnsafe(`
    SELECT "product_name", "merchant_name", COUNT(*) as count
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    GROUP BY "product_name", "merchant_name"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  console.log(`Exact Name & Merchant Duplicate Groups: ${(exactDuplicates as any[]).length}`);
  if ((exactDuplicates as any[]).length > 0) {
    console.log('Sample exact duplicates:', (exactDuplicates as any[]).slice(0, 5));
  }

  // 2. Check smart base name duplication (same rule as power_dedup_fixed.ts)
  console.log('\nChecking for smart base name deduplication groups...');
  const colorRegex = 'grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beige|teal|silver|gold|charcoal|anthracite|natural|steel|taupe|sand|ochre|mustard|emerald|sage|olive';
  
  const smartDuplicates = await prisma.$queryRawUnsafe(`
    SELECT 
      TRIM(BOTH ' -_' FROM 
        REGEXP_REPLACE(
          REGEXP_REPLACE(LOWER("product_name"), '\\y(in|with|color|colour)\\y', '', 'g'),
          '\\y(${colorRegex})\\y', 
          '', 
          'gi'
        )
      ) as base_name,
      "brand_name",
      "merchant_name",
      COUNT(*) as count
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    GROUP BY base_name, "brand_name", "merchant_name"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  console.log(`Smart Base Name Duplicate Groups: ${(smartDuplicates as any[]).length}`);
  if ((smartDuplicates as any[]).length > 0) {
    console.log('Sample smart base name duplicates:', (smartDuplicates as any[]).slice(0, 5));
  }

  // 3. Check for any color variants without products (orphaned variants)
  console.log('\nChecking for orphaned color variants (no matching product)...');
  const orphanedCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count
    FROM "ProductColorVariant" v
    LEFT JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON v."product_id" = p."aw_product_id"
    WHERE p."aw_product_id" IS NULL
  `);
  console.log(`Orphaned variants: ${(orphanedCount as any[])[0].count}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
