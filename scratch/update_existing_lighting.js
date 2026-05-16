require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateExistingLighting() {
  console.log('Starting lighting category update...');
  
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { category: { contains: 'light', mode: 'insensitive' } },
        { name: { contains: 'light', mode: 'insensitive' } },
        { description: { contains: 'light', mode: 'insensitive' } },
        { productType: { contains: 'light', mode: 'insensitive' } }
      ]
    }
  });

  console.log(`Found ${products.length} potential lighting products to check.`);

  let updatedCount = 0;

  for (const product of products) {
    const name = (product.name || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const type = (product.productType || '').toLowerCase();
    const merchantCategory = (product.merchantCategory || '').toLowerCase();
    
    // Combine fields to search for keywords
    const combinedText = `${name} ${desc} ${type} ${merchantCategory}`;

    const hasLED = /\bLED\b/i.test(combinedText);
    const hasLightingType = /\b(wall|floor|table|lamp)s?\b/i.test(combinedText);

    if (hasLED && hasLightingType) {
      let newCategory = '';
      if (/\bwall\b/i.test(combinedText)) newCategory = 'Wall LED';
      else if (/\bfloor\b/i.test(combinedText)) newCategory = 'Floor LED';
      else if (/\btable\b/i.test(combinedText)) newCategory = 'Table LED';
      else if (/\blamp\b/i.test(combinedText)) newCategory = 'Lamp LED';

      if (newCategory && product.category !== newCategory) {
        await prisma.product.update({
          where: { id: product.id },
          data: { category: newCategory }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Finished! Updated ${updatedCount} products to new LED categories.`);
}

updateExistingLighting()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
