"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Starting variant combination migration...');
    console.log('Combining products by parentProductId...');
    const groupedByParent = await prisma.$queryRaw `
    SELECT "parentProductId", COUNT(*), MIN(id) as "mainId"
    FROM "Product"
    WHERE "parentProductId" IS NOT NULL AND "parentProductId" != ''
    GROUP BY "parentProductId"
    HAVING COUNT(*) > 1;
  `;
    let combinedCount = 0;
    for (const group of groupedByParent) {
        const parentId = group.parentProductId;
        const mainId = group.mainId;
        const variants = await prisma.$queryRaw `
      SELECT id, "awinId", "colour", "imageUrl", "productUrl"
      FROM "Product"
      WHERE "parentProductId" = ${parentId} AND id != ${mainId};
    `;
        for (const variant of variants) {
            if (!variant.colour)
                continue;
            await prisma.$executeRawUnsafe(`
        INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${mainId}', '${variant.colour.replace(/'/g, "''")}', '${variant.imageUrl || ''}', '${variant.productUrl || ''}', '${variant.awinId || ''}', NOW(), NOW())
        ON CONFLICT ("awinId") DO NOTHING;
      `);
            await prisma.$executeRaw `DELETE FROM "Product" WHERE id = ${variant.id};`;
            combinedCount++;
        }
    }
    console.log(`Combined ${combinedCount} products using parentProductId.`);
    console.log('Combining products by exact name and merchant...');
    const groupedByName = await prisma.$queryRaw `
    SELECT "name", "merchant", COUNT(*), MIN(id) as "mainId"
    FROM "Product"
    WHERE "name" IS NOT NULL AND "merchant" IS NOT NULL
    GROUP BY "name", "merchant"
    HAVING COUNT(*) > 1;
  `;
    let combinedByNameCount = 0;
    for (const group of groupedByName) {
        const name = group.name;
        const merchant = group.merchant;
        const mainId = group.mainId;
        const variants = await prisma.$queryRaw `
      SELECT id, "awinId", "colour", "imageUrl", "productUrl"
      FROM "Product"
      WHERE "name" = ${name} AND "merchant" = ${merchant} AND id != ${mainId};
    `;
        for (const variant of variants) {
            if (!variant.colour)
                continue;
            await prisma.$executeRawUnsafe(`
        INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${mainId}', '${variant.colour.replace(/'/g, "''")}', '${variant.imageUrl || ''}', '${variant.productUrl || ''}', '${variant.awinId || ''}', NOW(), NOW())
        ON CONFLICT ("awinId") DO NOTHING;
      `);
            await prisma.$executeRaw `DELETE FROM "Product" WHERE id = ${variant.id};`;
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
//# sourceMappingURL=combine-variants.js.map