import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting variant combination migration...');

  // Step 1: Combine by parentProductId
  console.log('Combining products by parentProductId...');
  
  // Find all parentProductIds that have more than 1 product
  const groupedByParent = await prisma.$queryRaw`
    SELECT "parentProductId", COUNT(*), MIN(id) as "mainId"
    FROM "Product"
    WHERE "parentProductId" IS NOT NULL AND "parentProductId" != ''
    GROUP BY "parentProductId"
    HAVING COUNT(*) > 1;
  `;

  let combinedCount = 0;

  for (const group of (groupedByParent as any[])) {
    const parentId = group.parentProductId;
    const mainId = group.mainId;

    // Get all products for this parent except the main one
    const variants = await prisma.$queryRaw`
      SELECT id, "awinId", "colour", "imageUrl", "productUrl"
      FROM "Product"
      WHERE "parentProductId" = ${parentId} AND id != ${mainId};
    `;

    for (const variant of (variants as any[])) {
      if (!variant.colour) continue;

      // Create ProductColorVariant
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${mainId}', '${variant.colour.replace(/'/g, "''")}', '${variant.imageUrl || ''}', '${variant.productUrl || ''}', '${variant.awinId || ''}', NOW(), NOW())
        ON CONFLICT ("awinId") DO NOTHING;
      `);

      // Delete the variant product
      await prisma.$executeRaw`DELETE FROM "Product" WHERE id = ${variant.id};`;
      combinedCount++;
    }
  }

  console.log(`Combined ${combinedCount} products using parentProductId.`);

  // Step 2: Combine by exact name and merchant (fallback)
  console.log('Combining products by exact name and merchant...');
  const groupedByName = await prisma.$queryRaw`
    SELECT "name", "merchant", COUNT(*), MIN(id) as "mainId"
    FROM "Product"
    WHERE "name" IS NOT NULL AND "merchant" IS NOT NULL
    GROUP BY "name", "merchant"
    HAVING COUNT(*) > 1;
  `;

  let combinedByNameCount = 0;

  for (const group of (groupedByName as any[])) {
    const name = group.name;
    const merchant = group.merchant;
    const mainId = group.mainId;

    const variants = await prisma.$queryRaw`
      SELECT id, "awinId", "colour", "imageUrl", "productUrl"
      FROM "Product"
      WHERE "name" = ${name} AND "merchant" = ${merchant} AND id != ${mainId};
    `;

    for (const variant of (variants as any[])) {
      if (!variant.colour) continue;

      await prisma.$executeRawUnsafe(`
        INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${mainId}', '${variant.colour.replace(/'/g, "''")}', '${variant.imageUrl || ''}', '${variant.productUrl || ''}', '${variant.awinId || ''}', NOW(), NOW())
        ON CONFLICT ("awinId") DO NOTHING;
      `);

      await prisma.$executeRaw`DELETE FROM "Product" WHERE id = ${variant.id};`;
      combinedByNameCount++;
    }
  }

  console.log(`Combined ${combinedByNameCount} products using name and merchant.`);
  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
