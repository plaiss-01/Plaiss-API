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
    console.log('Starting extremely fast raw SQL deduplication...');
    console.log('1. Grouping by parentProductId...');
    const res1 = await prisma.$executeRawUnsafe(`
    WITH groups AS (
      SELECT "parentProductId", MIN(id) as "mainId"
      FROM "Product"
      WHERE "parentProductId" IS NOT NULL AND "parentProductId" != ''
      GROUP BY "parentProductId"
      HAVING COUNT(*) > 1
    ),
    variants AS (
      SELECT p.id, p."colour", p."imageUrl", p."productUrl", p."awinId", g."mainId"
      FROM "Product" p
      JOIN groups g ON p."parentProductId" = g."parentProductId"
      WHERE p.id != g."mainId" AND p."colour" IS NOT NULL AND p."colour" != ''
    ),
    inserted AS (
      INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "mainId", "colour", "imageUrl", "productUrl", "awinId", NOW(), NOW()
      FROM variants
      ON CONFLICT ("awinId") DO NOTHING
    )
    DELETE FROM "Product" WHERE id IN (SELECT id FROM variants);
  `);
    console.log(`Executed parentProductId deduplication. Rows affected: ${res1}`);
    console.log('2. Grouping by productModel & brandName...');
    const res2 = await prisma.$executeRawUnsafe(`
    WITH groups AS (
      SELECT "productModel", "brandName", MIN(id) as "mainId"
      FROM "Product"
      WHERE "productModel" IS NOT NULL AND "productModel" != '' AND "brandName" IS NOT NULL AND "brandName" != ''
      GROUP BY "productModel", "brandName"
      HAVING COUNT(*) > 1
    ),
    variants AS (
      SELECT p.id, p."colour", p."imageUrl", p."productUrl", p."awinId", g."mainId"
      FROM "Product" p
      JOIN groups g ON p."productModel" = g."productModel" AND p."brandName" = g."brandName"
      WHERE p.id != g."mainId" AND p."colour" IS NOT NULL AND p."colour" != ''
    ),
    inserted AS (
      INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "mainId", "colour", "imageUrl", "productUrl", "awinId", NOW(), NOW()
      FROM variants
      ON CONFLICT ("awinId") DO NOTHING
    )
    DELETE FROM "Product" WHERE id IN (SELECT id FROM variants);
  `);
    console.log(`Executed productModel deduplication. Rows affected: ${res2}`);
    console.log('3. Grouping by smart base name match...');
    const res3 = await prisma.$executeRawUnsafe(`
    WITH norm AS (
      SELECT id, "merchant", "colour", "imageUrl", "productUrl", "awinId",
             TRIM(BOTH ' -_' FROM REPLACE(LOWER(name), LOWER("colour"), '')) as base_name
      FROM "Product"
      WHERE "colour" IS NOT NULL AND "colour" != '' AND "name" IS NOT NULL
    ),
    groups AS (
      SELECT base_name, "merchant", MIN(id) as "mainId"
      FROM norm
      WHERE LENGTH(base_name) > 5
      GROUP BY base_name, "merchant"
      HAVING COUNT(*) > 1
    ),
    variants AS (
      SELECT n.id, n."colour", n."imageUrl", n."productUrl", n."awinId", g."mainId"
      FROM norm n
      JOIN groups g ON n.base_name = g.base_name AND n."merchant" = g."merchant"
      WHERE n.id != g."mainId"
    ),
    inserted AS (
      INSERT INTO "ProductColorVariant" ("id", "productId", "colorName", "imageUrl", "productUrl", "awinId", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "mainId", "colour", "imageUrl", "productUrl", "awinId", NOW(), NOW()
      FROM variants
      ON CONFLICT ("awinId") DO NOTHING
    )
    DELETE FROM "Product" WHERE id IN (SELECT id FROM variants);
  `);
    console.log(`Executed smart base name deduplication. Rows affected: ${res3}`);
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
//# sourceMappingURL=run-dedup.js.map