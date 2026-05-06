import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const rootSofa = await prisma.category.findFirst({
    where: { 
      name: { equals: 'sofas', mode: 'insensitive' }
    }
  });

  if (!rootSofa) {
    console.log('Category "Sofas" not found!');
    return;
  }

  console.log(`Root Sofa: ${rootSofa.name} (ID: ${rootSofa.id})`);

  // Recursive function to print tree
  async function printTree(id: string, depth: number = 0) {
    const children = await prisma.category.findMany({ where: { parentId: id } });
    for (const child of children) {
      console.log(`${'  '.repeat(depth)}└─ ${child.name} (ID: ${child.id})`);
      await printTree(child.id, depth + 1);
    }
  }

  await printTree(rootSofa.id);
}

main().finally(() => prisma.$disconnect());
