import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    console.log('Testing Prisma connection and queries...');
    
    const productCount = await prisma.product.count();
    console.log('Total Products in PROD table:', productCount);

    const variantCount = await prisma.productColorVariant.count();
    console.log('Total Color Variants in table:', variantCount);

    console.log('Fetching a sample product to verify schema update...');
    const sample = await prisma.product.findFirst({
      select: { id: true, name: true, salesDiscount: true }
    });
    console.log('Sample Product:', sample);

    console.log('\nVerifying that we can query with include (which failed originally)...');
    const sampleWithVariants = await prisma.product.findFirst({
      where: { id: sample?.id },
      include: { colorVariants: true }
    });
    console.log('Sample with variants included successfully!');

    console.log('\n[SUCCESS] All code and database checks passed!');
  } catch (e) {
    console.error('\n[ERROR] Check failed:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
