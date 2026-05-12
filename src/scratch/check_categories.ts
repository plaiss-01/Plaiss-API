import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = ['Plants', 'Light', 'Decor', 'Sofa', 'Tables', 'Beds'];
  console.log('Checking categories in DB:');
  for (const cat of categories) {
    const found = await (prisma as any).category.findFirst({
      where: { name: { equals: cat, mode: 'insensitive' } },
    });
    console.log(`${cat}: ${found ? 'Available' : 'Not Available'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
