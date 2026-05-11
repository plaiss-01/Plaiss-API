import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const categories = await prisma.category.findMany({
    take: 10,
  });

  console.log('Categories in DB:');
  for (const c of categories) {
    console.log(`Name: "${c.name}", isAwin: ${c.isAwin}`);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
