import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const sofaCats = await prisma.category.findMany({
    where: { 
      OR: [
        { name: { contains: 'sofa', mode: 'insensitive' } },
        { slug: { contains: 'sofa', mode: 'insensitive' } }
      ]
    }
  });

  console.log('Sofa Related Categories:');
  for (const cat of sofaCats) {
    const children = await prisma.category.findMany({ where: { parentId: cat.id } });
    console.log(`- ${cat.name} (ID: ${cat.id}, Parent: ${cat.parentId}) has ${children.length} children.`);
    for (const child of children) {
        console.log(`  └─ ${child.name} (ID: ${child.id})`);
    }
  }
}

main().finally(() => prisma.$disconnect());
