import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Checking Furniture Category Products ===\n');

  // Define keywords that belong to the furniture/sofa department
  const furnitureKeywords = ['furniture', 'sofa', 'chair', 'table', 'stool', 'armchair', 'bench', 'ottoman', 'cabinet', 'sideboard', 'credenza', 'bookcase', 'wardrobe', 'bed'];
  
  // 1. Get total products matching furniture keywords in name, category, or merchant_category
  console.log('1. Analyzing total counts...');
  const totalFurnitureProducts = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "category_name" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR "merchant_category" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR "product_name" ~* '\\y(sofa|sofas|armchair|armchairs|footstool|footstools|love chair|love chairs)\\y'
  `);
  const totalCount = Number((totalFurnitureProducts as any[])[0].count);
  console.log(`Total active furniture/sofa products in database: ${totalCount}`);

  // 2. Count variants linked to furniture/sofa products
  const furnitureVariants = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count
    FROM "ProductColorVariant" v
    JOIN "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" p ON v."product_id" = p."aw_product_id"
    WHERE p."category_name" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR p."merchant_category" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR p."product_name" ~* '\\y(sofa|sofas|armchair|armchairs|footstool|footstools|love chair|love chairs)\\y'
  `);
  const variantCount = Number((furnitureVariants as any[])[0].count);
  console.log(`Total color variants merged under furniture/sofa: ${variantCount}`);

  // 3. Category distribution for furniture/sofa products
  console.log('\n2. Category Name Distribution:');
  const catDistribution = await prisma.$queryRawUnsafe(`
    SELECT "category_name", COUNT(*) as count
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "category_name" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR "merchant_category" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR "product_name" ~* '\\y(sofa|sofas|armchair|armchairs|footstool|footstools|love chair|love chairs)\\y'
    GROUP BY "category_name"
    ORDER BY count DESC
  `);
  console.table(catDistribution);

  // 4. Merchant distribution for furniture/sofa products
  console.log('\n3. Merchant Distribution:');
  const merchantDistribution = await prisma.$queryRawUnsafe(`
    SELECT "merchant_name", COUNT(*) as count
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "category_name" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR "merchant_category" ~* 'sofa|furniture|chair|table|stool|armchair'
       OR "product_name" ~* '\\y(sofa|sofas|armchair|armchairs|footstool|footstools|love chair|love chairs)\\y'
    GROUP BY "merchant_name"
    ORDER BY count DESC
  `);
  console.table(merchantDistribution);

  // 5. Look for potential unmerged duplicates specifically in furniture/sofa categories
  console.log('\n4. Check for potential unmerged duplicates in furniture...');
  const baseNameQuery = `
    WITH groups AS (
      SELECT 
        TRIM(BOTH ' -_' FROM 
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER("product_name"), '\\y(in|with|color|colour)\\y', '', 'g'),
            '\\y(grey|gray|cream|blue|navy|black|white|red|green|yellow|pink|purple|orange|brown|beige|teal|silver|gold|charcoal|anthracite|natural|steel|taupe|sand|ochre|mustard|emerald|sage|olive)\\y', 
            '', 
            'gi'
          )
        ) as base_name,
        "brand_name",
        "merchant_name",
        COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE "category_name" ~* 'sofa|furniture|chair|table|stool|armchair'
         OR "merchant_category" ~* 'sofa|furniture|chair|table|stool|armchair'
         OR "product_name" ~* '\\y(sofa|sofas|armchair|armchairs|footstool|footstools|love chair|love chairs)\\y'
      GROUP BY base_name, "brand_name", "merchant_name"
      HAVING COUNT(*) > 1
    )
    SELECT * FROM groups ORDER BY count DESC;
  `;
  const potentialDuplicates = await prisma.$queryRawUnsafe(baseNameQuery);
  console.log(`Unmerged duplicate groups under furniture/sofa (based on smart base name and brand): ${(potentialDuplicates as any[]).length}`);
  if ((potentialDuplicates as any[]).length > 0) {
    console.log('Sample groups that could be merged but differ somehow (e.g. brand name/exact naming differences):');
    console.log(potentialDuplicates);
  } else {
    console.log('Success! All furniture/sofa duplicates are completely merged according to base name and brand.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
