import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching unique sizes from PROD table...');
  const sizes = await prisma.$queryRawUnsafe<{ size_stock_status_clean: string }[]>(`
    SELECT DISTINCT size_stock_status_clean 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE size_stock_status_clean IS NOT NULL AND size_stock_status_clean != ''
    LIMIT 50
  `);

  console.log('Unique Sizes found:');
  console.log(sizes.map(s => s.size_stock_status_clean));
}

main().finally(() => prisma.$disconnect());
