const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpdate() {
  const id = 'b21205d3-df33-45df-9f2d-7b0e3ceec46d';
  try {
    const res = await prisma.category.update({
      where: { id },
      data: { isMerged: true }
    });
    console.log('Update success:', res);
  } catch (err) {
    console.error('Update failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testUpdate();
