import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: {
      OR: [
        { name: { contains: 'Decor', mode: 'insensitive' } },
        { name: { contains: 'Accessory', mode: 'insensitive' } },
        { name: { contains: 'Art', mode: 'insensitive' } }
      ]
    }
  });

  console.log(JSON.stringify(categories, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
