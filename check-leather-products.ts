import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const leatherSofaCat = await prisma.category.findFirst({
    where: { name: { contains: 'Leather Sofas', mode: 'insensitive' } }
  });

  if (!leatherSofaCat) {
    console.log('Leather Sofas category not found');
    return;
  }

  const products = await prisma.product.findMany({
    where: { category: { contains: leatherSofaCat.name, mode: 'insensitive' } },
    take: 5,
    select: { name: true, category: true }
  });

  console.log(`Products in Leather Sofas (ID: ${leatherSofaCat.id}):`);
  products.forEach(p => console.log(`- ${p.name} (String Cat: ${p.category})`));
}

main().finally(() => prisma.$disconnect());
