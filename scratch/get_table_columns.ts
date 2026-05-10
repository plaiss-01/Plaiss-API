import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching actual columns from database...');
  const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'AWIN_AFFILIAT_PRODUCTS_DATA_PROD'
  `);
  
  console.log('Actual Database Columns:', columns.map(c => c.column_name));
}

main().finally(() => prisma.$disconnect());
