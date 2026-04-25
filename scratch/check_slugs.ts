import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not defined');

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.product.count({ where: { slug: null } });
  console.log('Products without slugs:', count);
  
  if (count > 0) {
    console.log('Updating products without slugs...');
    const products = await prisma.product.findMany({
      where: { slug: null },
      take: 1000
    });
    
    for (const p of products) {
      const slug = p.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      await prisma.product.update({
        where: { id: p.id },
        data: { slug }
      });
    }
    console.log('Finished updating first 1000.');
  }
}

main().catch(console.error).finally(() => { prisma.$disconnect(); pool.end(); });
