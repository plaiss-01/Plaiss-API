import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking PROD table data...');
  const products = await prisma.product.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      category: true,
      merchant: true
    }
  });
  
  console.log('Sample Products:', JSON.stringify(products, null, 2));
}

main().finally(() => prisma.$disconnect());
