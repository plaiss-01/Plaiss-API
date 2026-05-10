import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing PROD table...');
  try {
    const result = await prisma.$executeRawUnsafe('TRUNCATE TABLE "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"');
    console.log('Successfully cleared PROD table.');
  } catch (err: any) {
    console.error('Error clearing table:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
