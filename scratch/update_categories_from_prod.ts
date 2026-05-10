import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}

async function main() {
  console.log('Fetching unique categories from PROD table...');
  
  // 1. Get unique category names from products
  const uniqueCats = await prisma.$queryRawUnsafe<{ category_name: string }[]>(`
    SELECT DISTINCT category_name 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IS NOT NULL AND category_name != ''
  `);

  console.log(`Found ${uniqueCats.length} unique categories.`);

  // 2. Clear existing categories
  console.log('Clearing existing Category table...');
  await prisma.$queryRawUnsafe(`DELETE FROM "Category"`);

  // 3. Insert new categories
  console.log('Inserting categories derived from products...');
  for (const cat of uniqueCats) {
    const name = cat.category_name.trim();
    const slug = toSlug(name);
    
    try {
      // Use raw SQL or Prisma to insert
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Category" (id, name, slug, "isAwin", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING
      `, 
      slug, name, slug, true);
    } catch (err) {
      console.error(`Failed to insert ${name}:`, err);
    }
  }

  console.log('Categories updated successfully!');
}

main().finally(() => prisma.$disconnect());
