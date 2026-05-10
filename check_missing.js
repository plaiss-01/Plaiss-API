const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const countNoImage = await prisma.product.count({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: '' },
        { imageUrl: 'Original' }
      ]
    }
  });

  const countNoColorAndSize = await prisma.product.count({
    where: {
      OR: [
        { colour: null, sizeStockStatus: null },
        { colour: '', sizeStockStatus: '' }
      ]
    }
  });

  const countMissingAll = await prisma.product.count({
    where: {
      AND: [
        { OR: [{ imageUrl: null }, { imageUrl: '' }] },
        { OR: [{ colour: null }, { colour: '' }, { colour: 'Original' }] },
        { OR: [{ sizeStockStatus: null }, { sizeStockStatus: '' }] }
      ]
    }
  });

  console.log('Total products missing Image:', countNoImage);
  console.log('Total products missing Color & Size:', countNoColorAndSize);
  console.log('Total products missing ALL THREE (Image, Color, Size):', countMissingAll);
  
  const total = await prisma.product.count();
  console.log('Total products in DB:', total);
}

main().catch(console.error).finally(() => prisma.$disconnect());
