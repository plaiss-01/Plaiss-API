const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const badSlug = 'httpswwwplaisscomfurnituresubsofaspage1sizes2seater&page=1';
  
  const cat = await prisma.category.findFirst({
    where: { slug: badSlug }
  });
  
  if (cat) {
    console.log("Found bad category:", cat.id, cat.name);
    const updated = await prisma.category.update({
      where: { id: cat.id },
      data: { slug: 'two-seater' }
    });
    console.log("Updated to:", updated.slug);
  } else {
    console.log("Category not found with that slug.");
    
    // Check if it's stored exactly like that but maybe url encoded or something
    const all = await prisma.category.findMany({
      where: { name: 'two-seater' }
    });
    console.log("Found two-seater categories:", all.map(a => a.slug));
  }
}

run()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
