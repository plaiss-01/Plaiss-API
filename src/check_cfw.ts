import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    where: {
      merchant: {
        contains: 'Cheap Furniture Warehouse',
        mode: 'insensitive',
      },
    },
    take: 20,
  });

  console.log(`Found ${products.length} products`);
  for (const p of products) {
    console.log('---');
    console.log(`ID: ${p.id}, Name: ${p.name}`);
    console.log(`imageUrl: ${p.imageUrl}`);
    if (p.rawRow) {
      try {
        const raw = typeof p.rawRow === 'string' ? JSON.parse(p.rawRow) : p.rawRow;
        console.log('rawRow images:', {
          large_image: raw.large_image,
          alternate_image: raw.alternate_image,
          alternate_image_two: raw.alternate_image_two,
          alternate_image_three: raw.alternate_image_three,
          alternate_image_four: raw.alternate_image_four,
          merchant_image_url: raw.merchant_image_url,
          merchant_thumb_url: raw.merchant_thumb_url,
          aw_thumb_url: raw.aw_thumb_url,
        });
      } catch (e) {
        console.log('rawRow parse error');
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
