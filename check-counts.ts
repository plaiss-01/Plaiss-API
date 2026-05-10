import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const total = await prisma.product.count();
  const linked = await prisma.product.count({ where: { category: { not: null } } });
  console.log(`Total Products: ${total}`);
  console.log(`Linked Products: ${linked}`);
}

main().finally(() => prisma.$disconnect());
