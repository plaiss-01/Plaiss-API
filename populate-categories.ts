import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

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

async function main() {
  console.log('Extracting and parsing hierarchical categories from Products...');
  
  const products = await prisma.product.findMany({
    select: { category: true }
  });

  const uniqueCategoryPaths = new Set<string>();
  products.forEach(p => {
    if (p.category) {
      uniqueCategoryPaths.add(p.category.trim());
    }
  });

  console.log(`Found ${uniqueCategoryPaths.size} unique category paths.`);

  for (const pathStr of uniqueCategoryPaths) {
    const parts = pathStr.split(' > ').map(p => p.trim());
    let lastParentId: string | null = null;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const slug = slugify(name);

      // We use name + parentId for uniqueness check if we wanted strict hierarchy, 
      // but the current schema has unique 'name'. 
      // This means 'Storage' can only exist once. 
      // If 'Furniture > Storage' and 'Tools > Storage' both exist, we have a conflict.
      // However, for this project, let's assume names are unique or handle the conflict.
      
      try {
        const category = await prisma.category.upsert({
          where: { name },
          update: {
            parentId: lastParentId // Update parent if it changed (optional)
          },
          create: {
            name,
            slug,
            parentId: lastParentId,
            isAwin: true
          }
        });
        lastParentId = category.id;
      } catch (err) {
        // If name uniqueness fails, we find the existing one to continue the chain
        const existing = await prisma.category.findUnique({ where: { name } });
        if (existing) {
          lastParentId = existing.id;
        } else {
          console.error(`Error processing category "${name}": ${err.message}`);
        }
      }
    }
  }

  const finalCount = await prisma.category.count();
  console.log(`Hierarchy populated. Total categories in DB: ${finalCount}`);
}


main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
