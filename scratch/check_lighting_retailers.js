const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: {
      name: {
        contains: 'lighting',
        mode: 'insensitive',
      }
    }
  });
  console.log("Categories matching 'lighting':", categories.map(c => c.name));

  for (const cat of categories) {
    const products = await prisma.product.groupBy({
      by: ['merchant'],
      where: {
        category: cat.name
      },
      _count: {
        id: true
      }
    });
    console.log(`\nRetailers for category '${cat.name}':`);
    console.table(products.map(p => ({ Merchant: p.merchant, Count: p._count.id })));
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
