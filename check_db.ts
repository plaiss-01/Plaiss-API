
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { category: { contains: 'Chairs', mode: 'insensitive' } },
        { merchantCategory: { contains: 'Chairs', mode: 'insensitive' } }
      ]
    },
    take: 5,
    select: { name: true, category: true, merchantCategory: true }
  });
  
  console.log(`Found ${products.length} products matching 'Chairs'`);
  products.forEach(p => console.log(`- ${p.name} | Cat: ${p.category} | MerchCat: ${p.merchantCategory}`));

  const chairsCat = await (prisma as any).category.findFirst({
    where: { name: { contains: 'Chairs', mode: 'insensitive' } },
    include: { children: true }
  });
  
  if (chairsCat) {
     console.log(`Chairs category: ${chairsCat.name}, children: ${chairsCat.children.length}`);
     const childNames = chairsCat.children.map((c: any) => c.name);
     console.log(`Child names: ${childNames.join(', ')}`);
     
     const whereOR = childNames.flatMap((name: string) => [
        { category: { contains: name, mode: 'insensitive' } },
        { merchantCategory: { contains: name, mode: 'insensitive' } }
      ]);
      
      const subProducts = await prisma.product.findMany({
        where: { OR: whereOR },
        take: 5
      });
      console.log(`Found ${subProducts.length} subproducts`);
  }

  await prisma.$disconnect();
}

main();
