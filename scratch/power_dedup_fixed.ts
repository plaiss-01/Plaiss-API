import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting Power Deduplication with Expanded Colors...');

  const tableName = '"AWIN_AFFILIAT_PRODUCTS_DATA_PROD"';

  // 1. First, populate the "colour" field from the name for products where it's missing
  console.log('Step 1: Extracting colors from names...');
  const colors = [
    'Grey', 'Gray', 'Cream', 'Blue', 'Navy', 'Black', 'White', 'Red', 'Green', 'Yellow', 
    'Pink', 'Purple', 'Orange', 'Brown', 'Beige', 'Teal', 'Silver', 'Gold', 'Charcoal', 'Anthracite',
    'Natural', 'Steel', 'Taupe', 'Sand', 'Ochre', 'Mustard', 'Emerald', 'Sage', 'Olive'
  ];

  for (const color of colors) {
    await prisma.$executeRawUnsafe(`
      UPDATE ${tableName}
      SET "colour" = '${color}'
      WHERE ("colour" IS NULL OR "colour" = '')
      AND "product_name" ~* '\\y${color}\\y'
    `);
  }

  // 2. Now run the smart base name deduplication
  console.log('Step 2: Grouping by smart base names...');
  
  // Expanded color regex string
  const colorRegex = 'grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beige|teal|silver|gold|charcoal|anthracite|natural|steel|taupe|sand|ochre|mustard|emerald|sage|olive';

  const dedupSql = `
    WITH groups AS (
      SELECT 
        MIN("aw_product_id") as primary_id,
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER("product_name"), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(${colorRegex})\\y', 
            '', 
            'gi'
          )
        ) as base_name,
        "brand_name",
        "merchant_name"
      FROM ${tableName}
      GROUP BY base_name, "brand_name", "merchant_name"
      HAVING COUNT(*) > 1
    ),
    variants AS (
      SELECT p."aw_product_id" as "id", p."colour", p."image_url", p."product_url", p."aw_product_id" as "awinId", g.primary_id, p."product_name" as "name"
      FROM ${tableName} p
      JOIN groups g ON 
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(p."product_name"), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(${colorRegex})\\y', 
            '', 
            'gi'
          )
        ) = g.base_name
        AND (p."brand_name" = g."brand_name" OR (p."brand_name" IS NULL AND g."brand_name" IS NULL))
        AND p."merchant_name" = g."merchant_name"
      WHERE p."aw_product_id" != g.primary_id
    )
    INSERT INTO "ProductColorVariant" ("id", "product_id", "color_name", "image_url", "product_url", "awin_id")
    SELECT 
      gen_random_uuid()::text, 
      primary_id, 
      COALESCE("colour", 
        CASE 
          WHEN "name" ~* '\\y(${colorRegex})\\y'
          THEN REGEXP_REPLACE("name", '.*\\y(${colorRegex})\\y.*', '\\1', 'gi')
          ELSE 'Unknown'
        END
      ), 
      "image_url", 
      "product_url", 
      "awinId"
    FROM variants
    ON CONFLICT DO NOTHING;
  `;

  const deleteSql = `
    WITH groups AS (
      SELECT 
        MIN("aw_product_id") as primary_id,
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER("product_name"), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(${colorRegex})\\y', 
            '', 
            'gi'
          )
        ) as base_name,
        "brand_name",
        "merchant_name"
      FROM ${tableName}
      GROUP BY base_name, "brand_name", "merchant_name"
      HAVING COUNT(*) > 1
    )
    DELETE FROM ${tableName}
    WHERE "aw_product_id" IN (
      SELECT p."aw_product_id"
      FROM ${tableName} p
      JOIN groups g ON 
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(p."product_name"), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(${colorRegex})\\y', 
            '', 
            'gi'
          )
        ) = g.base_name
        AND (p."brand_name" = g."brand_name" OR (p."brand_name" IS NULL AND g."brand_name" IS NULL))
        AND p."merchant_name" = g."merchant_name"
      WHERE p."aw_product_id" != g.primary_id
    );
  `;

  const rowsInserted = await prisma.$executeRawUnsafe(dedupSql);
  console.log(`Variants created: ${rowsInserted}`);

  const rowsDeleted = await prisma.$executeRawUnsafe(deleteSql);
  console.log(`Duplicate products removed: ${rowsDeleted}`);

  console.log('Deduplication complete!');
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
