const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCategories() {
  const categories = await prisma.category.findMany({
    include: {
      children: true
    }
  });

  const lighting = categories.find(c => c.name.toLowerCase().includes('lighting') || c.slug === 'lighting');
  
  if (lighting) {
    console.log('Lighting Category:', lighting.name, '(ID:', lighting.id, ')');
    console.log('Children:');
    lighting.children.forEach(child => {
      console.log(` - ${child.name} (Slug: ${child.slug})`);
    });

    const productsWithLED = await prisma.product.count({
      where: {
        category: {
          contains: 'LED'
        }
      }
    });
    console.log('\nProducts with "LED" in category name:', productsWithLED);

    const firstFive = await prisma.product.findMany({
        where: {
            category: {
                contains: 'LED'
            }
        },
        take: 5,
        select: {
            name: true,
            category: true,
            productType: true
        }
    });
    console.log('\nSample Products:', JSON.stringify(firstFive, null, 2));

  } else {
    console.log('Lighting category not found.');
  }
}

checkCategories().catch(console.error).finally(() => prisma.$disconnect());
