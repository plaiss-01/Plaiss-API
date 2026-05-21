const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const allCats = await prisma.category.findMany();
  console.log("All categories in DB:");
  console.log(allCats.map(c => ({ id: c.id, name: c.name, parentId: c.parentId })));

  // Test Sofa Count
  const sofaCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'sofas', mode: 'insensitive' } },
        { merchantCategory: { contains: 'sofas', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`\nProducts matching 'sofas': ${sofaCount}`);

  // Test Chair Count
  const chairCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'chairs', mode: 'insensitive' } },
        { merchantCategory: { contains: 'chairs', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'chairs': ${chairCount}`);

  // Test Tables Count
  const tableCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'tables', mode: 'insensitive' } },
        { merchantCategory: { contains: 'tables', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'tables': ${tableCount}`);

  // Test Table (singular) Count
  const tableSingularCount = await prisma.product.count({
    where: {
      OR: [
        { category: { contains: 'table', mode: 'insensitive' } },
        { merchantCategory: { contains: 'table', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`Products matching 'table' (singular): ${tableSingularCount}`);

  await prisma.$disconnect();
}

test();
