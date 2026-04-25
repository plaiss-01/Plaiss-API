
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not defined');

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function checkCategories() {
  console.log('Checking products per category...');
  
  const categories = await prisma.product.groupBy({
    by: ['category'],
    _count: {
      _all: true
    }
  });

  console.log('\nProducts per Category:');
  console.table(categories.map(c => ({
    Category: c.category || 'None',
    Count: c._count._all
  })));

  // Also check top-level categories if they contain subcategories
  const mainCategories = ['Furniture', 'Living Room', 'Bedroom', 'Kitchen', 'Outdoor', 'Lighting', 'Decor'];
  
  console.log('\nChecking matches for main categories (using contains):');
  for (const main of mainCategories) {
    const count = await prisma.product.count({
      where: {
        category: {
          contains: main,
          mode: 'insensitive'
        }
      }
    });
    console.log(`${main}: ${count} products`);
  }

  await prisma.$disconnect();
}

checkCategories().catch(console.error);
