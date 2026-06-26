import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: '40353049440' },
  });

  if (p?.productUrl) {
    try {
      const res = await fetch(p.productUrl, { redirect: 'follow' });
      console.log('Status:', res.status, res.statusText);
      const text = await res.text();
      
      // find any jpg, png, webp urls in the html
      const matches = text.match(/(?:https?:)?\/\/[^\s"'<>]+\.(?:jpg|png|webp|jpeg)[^\s"'<>]*/gi);
      console.log('Found image matches in HTML:', matches ? Array.from(new Set(matches)).slice(0, 15) : 'none');
    } catch (e: any) {
      console.log('Fetch error:', e.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
