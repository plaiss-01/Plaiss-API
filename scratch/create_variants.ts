import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting deduplication and variant creation...');

  // Fetch all products with necessary fields
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      colourClean: true,
      imageUrl: true,
      productUrl: true,
    },
  });

  console.log(`Fetched ${products.length} products.`);

  // Group by name
  const groups = new Map<string, typeof products>();
  for (const prod of products) {
    if (!prod.name) continue;
    const key = prod.name.trim().toLowerCase();
    const list = groups.get(key) || [];
    list.push(prod);
    groups.set(key, list);
  }

  let mergedCount = 0;
  let variantCount = 0;

  for (const [name, prods] of groups.entries()) {
    if (prods.length <= 1) continue;

    // Pick the first one as master
    const master = prods[0];
    console.log(`Processing group "${name}" with ${prods.length} products. Master ID: ${master.id}`);

    for (let i = 1; i < prods.length; i++) {
      const duplicate = prods[i];
      
      // Only merge if colors are different
      if (duplicate.colourClean && duplicate.colourClean !== master.colourClean) {
        console.log(`Merging ${duplicate.id} (${duplicate.colourClean}) into master ${master.id} (${master.colourClean})`);
        
        // Create variant
        await prisma.productColorVariant.upsert({
          where: { awinId: duplicate.id },
          update: {},
          create: {
            awinId: duplicate.id,
            colorName: duplicate.colourClean,
            imageUrl: duplicate.imageUrl,
            productUrl: duplicate.productUrl,
            productId: master.id,
          },
        });
        variantCount++;

        // Delete duplicate product
        await prisma.product.delete({
          where: { id: duplicate.id },
        });
        mergedCount++;
      }
    }
  }

  console.log(`Deduplication complete. Merged ${mergedCount} products into ${variantCount} variants.`);
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
