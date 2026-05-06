import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting Power Deduplication (Name Similarity)...');

  // 1. First, populate the "colour" field from the name for products where it's missing
  console.log('Step 1: Extracting colors from names...');
  const colors = [
    'Grey', 'Gray', 'Cream', 'Blue', 'Navy', 'Black', 'White', 'Red', 'Green', 'Yellow', 
    'Pink', 'Purple', 'Orange', 'Brown', 'Beige', 'Teal', 'Silver', 'Gold', 'Charcoal', 'Anthracite'
  ];

  for (const color of colors) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Product"
      SET "colour" = '${color}'
      WHERE ("colour" IS NULL OR "colour" = '')
      AND "name" ~* '\\y${color}\\y'
    `);
  }

  // 2. Now run the smart base name deduplication again
  console.log('Step 2: Grouping by smart base names...');
  const dedupSql = `
    WITH groups AS (
      SELECT 
        MIN(id) as primary_id,
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(name), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beig|teal|silver|gold|charcoal|anthracite)\\y', 
            '', 
            'gi'
          )
        ) as base_name,
        "brandName",
        "merchant"
      FROM "Product"
      GROUP BY base_name, "brandName", "merchant"
      HAVING COUNT(*) > 1
    ),
    variants AS (
      SELECT p.id, p."colour", p."imageUrl", p."productUrl", p."awinId", g.primary_id, p.name
      FROM "Product" p
      JOIN groups g ON 
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(p.name), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beig|teal|silver|gold|charcoal|anthracite)\\y', 
            '', 
            'gi'
          )
        ) = g.base_name
        AND (p."brandName" = g."brandName" OR (p."brandName" IS NULL AND g."brandName" IS NULL))
        AND p."merchant" = g."merchant"
      WHERE p.id != g.primary_id
    )
    INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId")
    SELECT 
      gen_random_uuid(), 
      primary_id, 
      COALESCE("colour", 
        CASE 
          WHEN name ~* '\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beig|teal|silver|gold|charcoal|anthracite)\\y'
          THEN REGEXP_REPLACE(name, '.*\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beig|teal|silver|gold|charcoal|anthracite)\\y.*', '\\1', 'gi')
          ELSE 'Unknown'
        END
      ), 
      "imageUrl", 
      "productUrl", 
      "awinId"
    FROM variants
    ON CONFLICT DO NOTHING;
  `;

  const deleteSql = `
    WITH groups AS (
      SELECT 
        MIN(id) as primary_id,
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(name), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beig|teal|silver|gold|charcoal|anthracite)\\y', 
            '', 
            'gi'
          )
        ) as base_name,
        "brandName",
        "merchant"
      FROM "Product"
      GROUP BY base_name, "brandName", "merchant"
      HAVING COUNT(*) > 1
    )
    DELETE FROM "Product"
    WHERE id IN (
      SELECT p.id
      FROM "Product" p
      JOIN groups g ON 
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(p.name), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beig|teal|silver|gold|charcoal|anthracite)\\y', 
            '', 
            'gi'
          )
        ) = g.base_name
        AND (p."brandName" = g."brandName" OR (p."brandName" IS NULL AND g."brandName" IS NULL))
        AND p."merchant" = g."merchant"
      WHERE p.id != g.primary_id
    );
  `;

  const rowsInserted = await prisma.$executeRawUnsafe(dedupSql);
  console.log(`Variants created: ${rowsInserted}`);

  const rowsDeleted = await prisma.$executeRawUnsafe(deleteSql);
  console.log(`Duplicate products removed: ${rowsDeleted}`);

  console.log('Deduplication complete!');
}

main().finally(() => prisma.$disconnect());
