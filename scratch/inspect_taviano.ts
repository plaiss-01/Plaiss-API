import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
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

  const product = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'Taviano',
        mode: 'insensitive'
      }
    }
  });

  if (product) {
    console.log('Full Product Data:');
    console.log(JSON.stringify(product, null, 2));
  } else {
    console.log('No product found.');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
