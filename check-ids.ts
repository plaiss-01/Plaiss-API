import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const ids = ['925b4398-3020-4f85-80e2-23afe0b12c84', 'ddf654ba-8aac-438e-9dad-816e5b4ccf13'];
  for (const id of ids) {
    const cat = await prisma.category.findUnique({ where: { id } });
    console.log(`ID ${id}: ${cat?.name} (Slug: ${cat?.slug})`);
  }
}

main().finally(() => prisma.$disconnect());
