import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Checking Extracted Colors in ProductColorVariant ===\n');

  // 1. Get distinct color names and their counts
  const colorCounts = await prisma.$queryRawUnsafe(`
    SELECT "color_name" as color, COUNT(*)::int as count
    FROM "ProductColorVariant"
    GROUP BY "color_name"
    ORDER BY count DESC
  `);

  console.log('Color Name Distribution in Variants:');
  console.table(colorCounts);

  // 2. Count "Unknown" colors
  const unknownVariants = await prisma.$queryRawUnsafe(`
    SELECT v."awin_id" as id, p."product_name" as name, p."colour", v."color_name"
    FROM "ProductColorVariant" v
    JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON v."awin_id" = p."aw_product_id"
    WHERE v."color_name" = 'Unknown'
    LIMIT 10
  `);

  console.log(`\nVariants with 'Unknown' color name: ${(unknownVariants as any[]).length}`);
  if ((unknownVariants as any[]).length > 0) {
    console.log('Sample of Unknown color variants (and their parent product info):');
    console.log(JSON.stringify(unknownVariants, null, 2));
  }

  // 3. Inspect color field on the parent products table to see if we missed extracting colors
  console.log('\nChecking products table where colour is still null or empty...');
  const missingColorStats = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as count
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "colour" IS NULL OR "colour" = ''
  `);
  console.log(`Products without any colour value: ${(missingColorStats as any[])[0].count}`);

  // 4. Sample products that don't have color and check if their names actually contain color words
  const sampleMissingColor = await prisma.$queryRawUnsafe(`
    SELECT "aw_product_id" as id, "product_name" as name
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE ("colour" IS NULL OR "colour" = '')
    LIMIT 10
  `);
  console.log('\nSample products missing colour value:');
  console.log(JSON.stringify(sampleMissingColor, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
