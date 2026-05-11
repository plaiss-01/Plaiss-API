import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting normalization...');

  // 1. Enforce material rule for sofas
  console.log('Enforcing material rule for sofas...');
  const sofas = await prisma.product.findMany({
    where: {
      OR: [
        { category: { contains: 'sofa', mode: 'insensitive' } },
        { merchantCategory: { contains: 'sofa', mode: 'insensitive' } },
      ],
    },
    select: { id: true, productModelClean: true },
  });

  console.log(`Found ${sofas.length} sofas. Checking materials...`);
  let updatedSofas = 0;
  for (const sofa of sofas) {
    const material = sofa.productModelClean?.toLowerCase() || '';
    if (material && !material.includes('fabric') && !material.includes('leather')) {
      await prisma.product.update({
        where: { id: sofa.id },
        data: { productModelClean: null },
      });
      updatedSofas++;
    }
  }
  console.log(`Updated ${updatedSofas} sofas to remove non-fabric/leather materials.`);

  // 2. Populate Categories
  console.log('Populating Categories...');
  const categories = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  });
  for (const cat of categories) {
    if (cat.category) {
      await prisma.category.upsert({
        where: { name: cat.category },
        update: {},
        create: { name: cat.category, slug: slugify(cat.category), isAwin: true },
      });
    }
  }

  // 3. Populate Colours
  console.log('Populating Colours...');
  const colours = await prisma.product.findMany({
    where: { colourClean: { not: null } },
    select: { colourClean: true },
    distinct: ['colourClean'],
  });
  for (const col of colours) {
    if (col.colourClean) {
      await prisma.colour.upsert({
        where: { name: col.colourClean },
        update: {},
        create: { name: col.colourClean },
      });
    }
  }

  // 4. Populate Sizes
  console.log('Populating Sizes...');
  const sizes = await prisma.product.findMany({
    where: { sizeStockStatusClean: { not: null } },
    select: { sizeStockStatusClean: true },
    distinct: ['sizeStockStatusClean'],
  });
  for (const sz of sizes) {
    if (sz.sizeStockStatusClean) {
      await prisma.size.upsert({
        where: { name: sz.sizeStockStatusClean },
        update: {},
        create: { name: sz.sizeStockStatusClean },
      });
    }
  }

  // 5. Populate Materials
  console.log('Populating Materials...');
  const materials = await prisma.product.findMany({
    where: { productModelClean: { not: null } },
    select: { productModelClean: true },
    distinct: ['productModelClean'],
  });
  for (const mat of materials) {
    if (mat.productModelClean) {
      await prisma.material.upsert({
        where: { name: mat.productModelClean },
        update: {},
        create: { name: mat.productModelClean },
      });
    }
  }

  // 6. Populate Retailers
  console.log('Populating Retailers...');
  const retailers = await prisma.product.findMany({
    where: { merchant: { not: null } },
    select: { merchant: true },
    distinct: ['merchant'],
  });
  for (const ret of retailers) {
    if (ret.merchant) {
      await prisma.retailer.upsert({
        where: { name: ret.merchant },
        update: {},
        create: { name: ret.merchant },
      });
    }
  }

  console.log('Normalization complete.');
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
