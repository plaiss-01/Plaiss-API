import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const count = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'Sofas', mode: 'insensitive' } },
        { category: { contains: 'Sofa', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Total products for Sofas/Sofa: ${count}`);
  
  const exactCount = await prisma.product.count({
    where: { category: 'Sofas' }
  });
  console.log(`Exact category 'Sofas' products: ${exactCount}`);
}

run();
