import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting raw SQL data migration...');

  // 1. Ensure Attributes Exist
  console.log('Ensuring attributes...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Attribute" ("id", "name", "createdAt", "updatedAt")
    VALUES 
      (gen_random_uuid(), 'Brand', NOW(), NOW()),
      (gen_random_uuid(), 'Colour', NOW(), NOW()),
      (gen_random_uuid(), 'Condition', NOW(), NOW()),
      (gen_random_uuid(), 'ProductType', NOW(), NOW()),
      (gen_random_uuid(), 'Model', NOW(), NOW())
    ON CONFLICT ("name") DO NOTHING;
  `);

  console.log('Migrating Categories...');
  // Find or create categories based on product string
  // Wait, Categories slug requires a slugify, which SQL can do roughly, but a simple replace is fine for migration.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Category" ("id", "name", "slug", "isAwin", "isMerged", "order", "createdAt", "updatedAt")
    SELECT DISTINCT 
      gen_random_uuid(), 
      TRIM(LOWER(category)), 
      regexp_replace(TRIM(LOWER(category)), '[^a-z0-9]+', '-', 'g') || '-' || substring(md5(random()::text) from 1 for 6),
      true, false, 0, NOW(), NOW()
    FROM "Product"
    WHERE category IS NOT NULL AND category != 'collection' AND TRIM(LOWER(category)) NOT IN (SELECT TRIM(LOWER(name)) FROM "Category")
    ON CONFLICT DO NOTHING;
  `);

  // Update Products with internalCategoryId
  console.log('Linking Categories to Products...');
  await prisma.$executeRawUnsafe(`
    UPDATE "Product" p
    SET "internalCategoryId" = c.id
    FROM "Category" c
    WHERE p."category" IS NOT NULL AND TRIM(LOWER(p."category")) = TRIM(LOWER(c."name"))
    AND p."internalCategoryId" IS NULL;
  `);

  const attributesMapping = [
    { name: 'Brand', column: '"brandName"' },
    { name: 'Colour', column: '"colour"' },
    { name: 'Condition', column: '"condition"' },
    { name: 'ProductType', column: '"productType"' },
    { name: 'Model', column: '"productModel"' },
  ];

  for (const mapping of attributesMapping) {
    console.log(`Migrating Attribute Values for ${mapping.name}...`);
    // Insert Attribute Values
    await prisma.$executeRawUnsafe(`
      INSERT INTO "AttributeValue" ("id", "value", "attributeId", "createdAt", "updatedAt")
      SELECT DISTINCT gen_random_uuid(), TRIM(${mapping.column}), a.id, NOW(), NOW()
      FROM "Product" p
      JOIN "Attribute" a ON a.name = '${mapping.name}'
      WHERE p.${mapping.column} IS NOT NULL AND TRIM(p.${mapping.column}) != ''
      ON CONFLICT ("attributeId", "value") DO NOTHING;
    `);

    console.log(`Linking Product Attributes for ${mapping.name}...`);
    // Insert Product Attributes
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ProductAttribute" ("id", "productId", "attributeId", "attributeValueId", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), p.id, a.id, av.id, NOW(), NOW()
      FROM "Product" p
      JOIN "Attribute" a ON a.name = '${mapping.name}'
      JOIN "AttributeValue" av ON av."attributeId" = a.id AND av.value = TRIM(p.${mapping.column})
      WHERE p.${mapping.column} IS NOT NULL AND TRIM(p.${mapping.column}) != ''
      ON CONFLICT ("productId", "attributeId") DO NOTHING;
    `);
  }

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
