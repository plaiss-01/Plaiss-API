import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching unique categories from PROD table...');
  const categories = await prisma.$queryRawUnsafe<{ category_name: string }[]>(`
    SELECT DISTINCT category_name 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name IS NOT NULL AND category_name != ''
    LIMIT 50
  `);

  console.log('Unique Categories found:');
  console.log(categories.map(c => c.category_name));
}

main().finally(() => prisma.$disconnect());
