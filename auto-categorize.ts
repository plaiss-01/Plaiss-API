
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

const KEYWORD_MAP: Record<string, string> = {
  // Living Room
  'sofa': 'Furniture > Living Room > Sofas',
  'couch': 'Furniture > Living Room > Sofas',
  'armchair': 'Furniture > Living Room > Sofas',
  'coffee table': 'Furniture > Living Room > Tables',
  'side table': 'Furniture > Living Room > Tables',
  'tv unit': 'Furniture > Living Room > TV Units',
  'tv stand': 'Furniture > Living Room > TV Units',
  'sideboard': 'Furniture > Living Room > Sideboards',
  
  // Bedroom
  'double bed': 'Furniture > Bedroom > Beds',
  'king size bed': 'Furniture > Bedroom > Beds',
  'single bed': 'Furniture > Bedroom > Beds',
  'bed': 'Furniture > Bedroom > Beds',
  'mattress': 'Furniture > Bedroom > Mattresses',
  'wardrobe': 'Furniture > Bedroom > Storage',
  'chest of drawers': 'Furniture > Bedroom > Storage',
  'bedside table': 'Furniture > Bedroom > Tables',

  // Kitchen & Dining
  'dining table': 'Furniture > Kitchen & Dining > Tables',
  'dining chair': 'Furniture > Kitchen & Dining > Chairs',
  'kitchen': 'Home > Kitchen',

  // Office
  'office chair': 'Furniture > Office > Chairs',
  'desk': 'Furniture > Office > Desks',

  // General Furniture
  'chair': 'Furniture > Seating',
  'table': 'Furniture > Tables',
  'cabinet': 'Furniture > Storage',
  'bookcase': 'Furniture > Storage > Bookcases',

  // Lighting
  'pendant light': 'Home > Lighting > Ceiling Lights',
  'floor lamp': 'Home > Lighting > Floor Lamps',
  'table lamp': 'Home > Lighting > Table Lamps',
  'lighting': 'Home > Lighting',
  'lamp': 'Home > Lighting',

  // Decor & Textiles
  'rug': 'Home > Textiles > Rugs',
  'cushion': 'Home > Textiles',
  'curtain': 'Home > Textiles',
  'mirror': 'Home > Decor',
  'vase': 'Home > Decor',
  'wall art': 'Home > Decor',

  // Garden
  'garden sofa': 'Home > Garden & Outdoor > Furniture',
  'patio': 'Home > Garden & Outdoor',
  'outdoor': 'Home > Garden & Outdoor',
};

async function autoCategorize() {
  console.log('Starting auto-categorization...');
  
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { category: null },
        { category: '' },
        { category: 'None' },
        { category: 'Storage' }, // Re-categorize generic storage
        { category: 'Chairs' }   // Re-categorize generic chairs
      ]
    },
    select: {
      id: true,
      name: true,
    }
  });

  console.log(`Found ${products.length} products to categorize.`);
  
  let updatedCount = 0;
  const batchSize = 100;
  const sortedKeywords = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (p) => {
      const nameLower = p.name.toLowerCase();
      let matchedCategory: string | null = null;

      for (const keyword of sortedKeywords) {
        if (nameLower.includes(keyword)) {
          matchedCategory = KEYWORD_MAP[keyword];
          break;
        }
      }

      if (matchedCategory) {
        await prisma.product.update({
          where: { id: p.id },
          data: { category: matchedCategory }
        });
        updatedCount++;
      }
    }));

    if (i % 1000 === 0 && i > 0) {
      console.log(`Processed ${i} products... Updated ${updatedCount} so far.`);
    }
  }

  console.log(`\nAuto-categorization complete!`);
  console.log(`Total products processed: ${products.length}`);
  console.log(`Total products successfully categorized: ${updatedCount}`);

  await prisma.$disconnect();
}

autoCategorize().catch(console.error);
