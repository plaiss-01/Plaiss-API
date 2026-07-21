const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: '2 Aveley 3 Seater', mode: 'insensitive' }
    },
    select: { id: true, name: true, category: true, merchantCategory: true, productType: true }
  });
  console.log(products);
}

run()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
