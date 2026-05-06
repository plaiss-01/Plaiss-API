import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    where: { 
      name: { contains: 'Flex Corduroy', mode: 'insensitive' }
    },
    include: {
      colorVariants: true
    }
  });

  console.log(`Found ${products.length} products matching "Flex Corduroy":`);
  products.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Colour: ${p.colour}, Variants: ${p.colorVariants.length}`);
  });
}

main().finally(() => prisma.$disconnect());
