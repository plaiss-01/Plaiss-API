import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'Laurel', mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      colourClean: true,
      brandName: true,
      merchant: true,
    },
  });

  console.log('Found Laurel products:', products.length);
  for (const p of products) {
    console.log(`ID: ${p.id}, Name: "${p.name}", Color: "${p.colourClean}", Brand: "${p.brandName}", Merchant: "${p.merchant}"`);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
