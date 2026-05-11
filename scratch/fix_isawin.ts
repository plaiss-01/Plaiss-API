import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.category.updateMany({
    where: {},
    data: { isAwin: true },
  });

  console.log(`Updated ${result.count} categories to isAwin: true.`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
