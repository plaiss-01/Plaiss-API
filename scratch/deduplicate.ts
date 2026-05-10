import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    console.log('Fetching all products with color variants (using select to avoid bad data)...');
    
    // We use select to avoid fetching 'sales_discount' which has invalid data ('No' instead of float) in DB
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        colour: true,
        imageUrl: true,
        productUrl: true,
        colorVariants: true,
      }
    });

    console.log(`Found ${allProducts.length} products.`);

    const groups = new Map<string, any[]>();

    allProducts.forEach((p: any) => {
      // Create a "Core Name" by stripping common variant terms
      let coreName = p.name
        .toLowerCase()
        .replace(/\b(fabric|leather|velvet|chenille|linen|wood|metal|glass|gloss|matt|oak|pine|walnut|ash|marble)\b/gi, '')
        .replace(/\b(\d+)\s*(seater|piece|set|pack|kg|g|cm|mm|m)\b/gi, '')
        .replace(/^[0-9\s-]+/, '') // Strip leading numbers
        .replace(/\s+/g, ' ')
        .trim();

      if (coreName.length < 5) coreName = p.name.toLowerCase().trim();

      const key = `${coreName}`;
      const group = groups.get(key) || [];
      group.push(p);
      groups.set(key, group);
    });

    console.log(`Grouped into ${groups.size} unique core names.`);

    let mergedCount = 0;
    let variantCount = 0;

    for (const [key, products] of groups.entries()) {
      if (products.length <= 1) continue;

      console.log(`\nProcessing group: "${key}" (${products.length} products)`);

      // Pick the best "Master" product (one with the most information or longest description)
      const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
      const master = sorted[0];
      const variants = sorted.slice(1);

      console.log(`  Master: ${master.name} (ID: ${master.id})`);

      for (const v of variants) {
        try {
          console.log(`  Merging Variant: ${v.name} (ID: ${v.id})`);

          // Check if it already has color info
          const colorName = v.colour || v.name.split(' ').find((word: string) => 
            ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold'].includes(word.toLowerCase())
          ) || 'Original';

          // Create variant in ProductColorVariant table
          await prisma.productColorVariant.upsert({
            where: { awinId: v.id }, // Use v.id as awinId since id is mapped to aw_product_id
            update: {
              colorName,
              imageUrl: v.imageUrl,
              productUrl: v.productUrl,
              productId: master.id,
            },
            create: {
              awinId: v.id,
              colorName,
              imageUrl: v.imageUrl,
              productUrl: v.productUrl,
              productId: master.id,
            },
          });

          // Move any existing variants of 'v' to 'master'
          if (v.colorVariants && v.colorVariants.length > 0) {
             await prisma.productColorVariant.updateMany({
                where: { productId: v.id },
                data: { productId: master.id }
             });
          }

          // Delete the duplicate product using pg directly to avoid Prisma validation errors on bad data
          await pool.query(`
            DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
            WHERE "aw_product_id" = $1
          `, [v.id]);
          
          mergedCount++;
          variantCount++;
        } catch (err: any) {
          console.error(`  Failed to merge ${v.name} into ${master.name}:`, err.message);
        }
      }
    }

    console.log(`\nDeduplication complete. Merged ${mergedCount} products into variants.`);

  } catch (e) {
    console.error('Error during execution:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
