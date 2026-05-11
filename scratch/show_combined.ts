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
    console.log('Fetching sample combined products...');
    
    // Fetch 5 products that have variants
    const masters = await prisma.product.findMany({
      where: {
        colorVariants: {
          some: {} // Has at least one variant
        }
      },
      include: {
        colorVariants: true
      },
      take: 5
    });

    console.log(`Found ${masters.length} master products with variants.\n`);

    for (const master of masters) {
      console.log(`Master: "${master.name}"`);
      console.log(`ID: ${master.id}`);
      console.log(`Variants found: ${master.colorVariants.length}`);
      master.colorVariants.forEach((v: any, index: number) => {
        console.log(`  ${index + 1}. Color: ${v.colorName} (Awin ID: ${v.awinId})`);
      });
      console.log('--------------------------------------------------\n');
    }

  } catch (e) {
    console.error('Error during fetch:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
