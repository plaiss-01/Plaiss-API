
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

async function checkSlugs() {
  console.log('Checking category table slugs...');
  
  const categories = await (prisma as any).category.findMany();
  
  console.log(`Found ${categories.length} category records.`);
  
  const report = categories.map(c => ({
    ID: c.id,
    Name: c.name,
    Slug: c.slug,
    HasSlug: !!c.slug,
    IsRoot: !c.parentId
  }));

  console.table(report);

  const missingSlugs = categories.filter(c => !c.slug);
  if (missingSlugs.length > 0) {
    console.log(`\nWarning: ${missingSlugs.length} categories are missing slugs!`);
  } else {
    console.log('\nAll category records have slugs.');
  }

  await prisma.$disconnect();
}

checkSlugs().catch(console.error);
