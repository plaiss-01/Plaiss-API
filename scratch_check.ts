import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const count = await prisma.product.count();
  console.log(`Current product count: ${count}`);
  
  const products = await prisma.product.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Recent products:');
  products.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, CreatedAt: ${p.createdAt}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
