import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const databaseUrl = env['DATABASE_URL'];
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const today = new Date();
  // Set to start of today (to only delete things created today)
  today.setHours(0, 0, 0, 0);

  console.log('Finding recently added Awin categories...');
  
  // Find categories created today with isAwin = true
  const recentCategories = await prisma.category.findMany({
    where: {
      isAwin: true,
      createdAt: {
        gte: today
      }
    }
  });

  console.log(`Found ${recentCategories.length} recently added categories.`);

  if (recentCategories.length > 0) {
    // Delete them
    const result = await prisma.category.deleteMany({
      where: {
        id: {
          in: recentCategories.map(c => c.id)
        }
      }
    });
    console.log(`Deleted ${result.count} categories.`);
  }

  // If the user also meant the products we added:
  // Since the original script cleared the entire table before we ran it, we can't restore the old ones.
  // But we can clear the category fields from products that were modified today.
  
  console.log('Clearing mapped category fields from recently added products...');
  const updatedProducts = await prisma.product.updateMany({
    where: {
      createdAt: {
        gte: today
      }
    },
    data: {
      categoryId: null,
      productType: null
    }
  });

  console.log(`Cleared category mappings for ${updatedProducts.count} products.`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
