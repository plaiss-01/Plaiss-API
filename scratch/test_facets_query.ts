import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Testing optimized facets query for "sofas" and "Sofas"...');
  
  // Instead of LOWER(), we pass both casings directly!
  const inList = "'sofas', 'Sofas'";

  console.log('Running sizes query...');
  const sizes = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT size_stock_status_clean 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IN (${inList})
    AND size_stock_status_clean IS NOT NULL AND size_stock_status_clean != ''
  `);
  console.log('Sizes done:', sizes);

  console.log('Running colors query...');
  const colors = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT colour_clean 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IN (${inList})
    AND colour_clean IS NOT NULL AND colour_clean != ''
  `);
  console.log('Colors done:', colors);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
