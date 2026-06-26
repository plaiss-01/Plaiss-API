import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Checking for Unmerged Products Due to Exotic Colors ===\n');

  // Let's find products that start with the same name but have different endings (often containing a color)
  // We can group by the first 3 words of the name and see if they belong to the same merchant but were not merged.
  const prefixDuplicates = await prisma.$queryRawUnsafe(`
    WITH split_names AS (
      SELECT 
        "aw_product_id" as id,
        "product_name" as name,
        "brand_name",
        "merchant_name",
        "colour",
        -- Get the first 3-4 words as a prefix
        REGEXP_REPLACE(LOWER("product_name"), '^((?:\\b\\w+\\b\\s*){3}).*$', '\\1') as name_prefix
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    ),
    prefix_groups AS (
      SELECT name_prefix, "brand_name", "merchant_name", COUNT(*) as count
      FROM split_names
      GROUP BY name_prefix, "brand_name", "merchant_name"
      HAVING COUNT(*) > 1
    )
    SELECT p.name_prefix, p.count, 
           array_agg(s.name) as names,
           array_agg(s.id) as ids,
           array_agg(COALESCE(s.colour, 'null')) as colours
    FROM prefix_groups p
    JOIN split_names s ON s.name_prefix = p.name_prefix 
      AND (s."brand_name" = p."brand_name" OR (s."brand_name" IS NULL AND p."brand_name" IS NULL))
      AND s."merchant_name" = p."merchant_name"
    GROUP BY p.name_prefix, p.count
    ORDER BY p.count DESC
    LIMIT 20
  `);

  console.log('Sample prefix groups that might be unmerged duplicates:');
  for (const group of (prefixDuplicates as any[])) {
    // If the group has different colors at the end of the name, print it
    const uniqueNames = Array.from(new Set(group.names));
    if (uniqueNames.length > 1) {
      console.log(`\nPrefix: "${group.name_prefix}" (Count: ${group.count})`);
      console.log(`- Brands: ${group.brand_name}`);
      console.log(`- Merchant: ${group.merchant_name}`);
      console.log(`- Products:`);
      for (let i = 0; i < group.names.length; i++) {
        console.log(`  * ID: ${group.ids[i]} | Name: "${group.names[i]}" | Colour: "${group.colours[i]}"`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
