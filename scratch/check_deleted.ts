import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  console.log('Checking for deleted categories...');
  const deletedCategories = await prisma.category.findMany({
    where: { isDeleted: true }
  });
  console.log(`Found ${deletedCategories.length} deleted categories:`, deletedCategories.map(c => c.name));

  // Check for products (though they don't have isDeleted, maybe they have something else?)
  // We can't find hard-deleted products.
  
  await prisma.$disconnect();
}

main();
