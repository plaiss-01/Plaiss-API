import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Targeted Deduplication for "Flex Corduroy"...');

  // 1. Find the products
  const products = await prisma.product.findMany({
    where: { name: { contains: 'Flex Corduroy', mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' }
  });

  if (products.length <= 1) {
    console.log('Not enough products found for deduplication.');
    return;
  }

  const primary = products[0];
  const variants = products.slice(1);

  console.log(`Primary Product: ${primary.name} (ID: ${primary.id})`);

  for (const variant of variants) {
    // Extract color from name
    const colorMatch = variant.name.match(/In\s+([a-zA-Z]+)/i);
    const colorName = colorMatch ? colorMatch[1] : 'Unknown';

    console.log(`- Adding variant: ${variant.name} as color "${colorName}"`);

    await prisma.productColorVariant.create({
      data: {
        productId: primary.id,
        colorName: colorName,
        imageUrl: variant.imageUrl,
        productUrl: variant.productUrl,
        awinId: variant.id,
      }
    });

    // Delete the duplicate product
    await prisma.product.delete({ where: { id: variant.id } });
  }

  console.log('Targeted deduplication complete!');
}

main().finally(() => prisma.$disconnect());
