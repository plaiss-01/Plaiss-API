
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Category' AND column_name = 'order';
    `;
    console.log('Column check result:', result);
    
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' }
    });
    console.log('Categories fetched successfully:', categories.length);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
