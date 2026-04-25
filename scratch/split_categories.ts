import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not defined');

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getOrCreateCategory(name: string, parentId: string | null = null) {
  const slug = slugify(name);
  let category = await (prisma as any).category.findFirst({
    where: { 
      OR: [
        { slug },
        { name: { equals: name, mode: 'insensitive' } }
      ]
    }
  });

  if (!category) {
    category = await (prisma as any).category.create({
      data: {
        name,
        slug,
        parentId,
        isAwin: true
      }
    });
  } else if (parentId && category.parentId !== parentId) {
    category = await (prisma as any).category.update({
      where: { id: category.id },
      data: { parentId }
    });
  }

  return category;
}

async function main() {
  console.log('Fetching unique path-like categories from products...');
  
  // 1. Find all unique category strings that are actually paths
  const productsWithPaths = await prisma.product.groupBy({
    by: ['category'],
    where: {
      OR: [
        { category: { contains: ' > ' } },
        { category: { contains: ' &gt; ' } },
        { category: { contains: ' | ' } }
      ]
    }
  });

  console.log(`Found ${productsWithPaths.length} unique paths to process.`);

  for (const group of productsWithPaths) {
    const rawPath = group.category || '';
    const parts = rawPath.split(/\s*[>|]\s*|\s*&gt;\s*/).map(p => p.trim()).filter(Boolean);
    
    if (parts.length > 1) {
      console.log(`Processing path: ${rawPath}`);
      let currentParentId: string | null = null;
      let leafName = '';

      for (const part of parts) {
        const cat = await getOrCreateCategory(part, currentParentId);
        currentParentId = cat.id;
        leafName = cat.name;
      }

      // Update all products with this exact path to the leaf name
      const updateCount = await prisma.product.updateMany({
        where: { category: rawPath },
        data: { category: leafName }
      });
      console.log(`Updated ${updateCount.count} products to category: ${leafName}`);
    }
  }

  // 2. Clean up Category table for any names that are paths
  console.log('Cleaning up Category table for any path-like names...');
  const catsWithPaths = await (prisma as any).category.findMany({
    where: {
      OR: [
        { name: { contains: ' > ' } },
        { name: { contains: ' &gt; ' } },
        { name: { contains: ' | ' } }
      ]
    }
  });

  for (const cat of catsWithPaths) {
    const parts = cat.name.split(/\s*[>|]\s*|\s*&gt;\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      let currentParentId: string | null = null;
      let leafName = '';
      for (const part of parts) {
        const subCat = await getOrCreateCategory(part, currentParentId);
        currentParentId = subCat.id;
        leafName = subCat.name;
      }
      
      // Update products pointing to this category name
      await prisma.product.updateMany({
        where: { category: cat.name },
        data: { category: leafName }
      });

      // Delete the old path category
      try {
        await (prisma as any).category.delete({ where: { id: cat.id } });
      } catch (e) {
        // Might fail if there are foreign key constraints other than products (handled by updateMany above)
      }
    }
  }

  console.log('Done.');
}

main().catch(console.error).finally(() => { prisma.$disconnect(); pool.end(); });
