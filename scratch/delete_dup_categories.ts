import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const databaseUrl = env['DATABASE_URL'];
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Finding duplicate categories...');
  const categories = await prisma.category.findMany();
  
  const nameCounts = new Map<string, number>();
  for (const cat of categories) {
    nameCounts.set(cat.name, (nameCounts.get(cat.name) || 0) + 1);
  }

  const duplicates = Array.from(nameCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([name]) => name);

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicated names.`);
    for (const name of duplicates) {
      const cats = await prisma.category.findMany({ where: { name } });
      // Keep the first one, delete the rest
      for (let i = 1; i < cats.length; i++) {
        await prisma.category.delete({ where: { id: cats[i].id } }).catch(() => {});
      }
    }
    console.log('Deleted duplicates.');
  } else {
    console.log('No duplicates found.');
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
