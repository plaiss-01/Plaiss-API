const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixImages() {
  console.log('--- Starting Image Fix Script ---');
  
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { imageUrl: { startsWith: 'http://' } },
        { imageUrl: '' },
        { imageUrl: null }
      ]
    },
    select: {
      id: true,
      imageUrl: true,
      awThumbUrl: true,
      largeImage: true,
      alternateImage: true
    }
  });

  console.log(`Found ${products.length} products with potentially broken or non-SSL images.`);

  let fixedCount = 0;
  for (const p of products) {
    let newUrl = p.imageUrl || '';
    
    // 1. Upgrade to HTTPS if needed
    if (newUrl.startsWith('http://')) {
      newUrl = newUrl.replace('http://', 'https://');
    }

    // 2. If empty, try fallbacks
    if (!newUrl || newUrl === '') {
      newUrl = p.largeImage || p.alternateImage || p.awThumbUrl || '';
      if (newUrl.startsWith('http://')) {
        newUrl = newUrl.replace('http://', 'https://');
      }
    }

    if (newUrl !== p.imageUrl) {
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: newUrl }
      });
      fixedCount++;
    }
  }

  console.log(`Successfully updated ${fixedCount} products.`);
  console.log('--- Script Finished ---');
}

fixImages()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
