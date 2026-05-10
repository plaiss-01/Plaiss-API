import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking counts for Sofas and 2 Seater...');
  
  // Check total sofas
  const sofas = await prisma.$queryRawUnsafe<{ count: string }[]>(`
    SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name ILIKE '%Sofa%'
  `);
  
  // Check sofas with 2 Seater size
  const sofasWith2Seater = await prisma.$queryRawUnsafe<{ count: string }[]>(`
    SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE category_name ILIKE '%Sofa%' 
    AND size_stock_status_clean ILIKE '%2 Seater%'
  `);

  console.log('Total Sofa products:', sofas[0].count);
  console.log('Sofa products with 2 Seater size:', sofasWith2Seater[0].count);
}

main().finally(() => prisma.$disconnect());
