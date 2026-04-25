
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

// Hardcoded categories from Header.tsx
const HARDCODED_NAMES = [
  'Living Room', 'Seating', 'Sofas', 'Armchairs', 'Corner Sofas', 'Footstools',
  'Storage', 'TV Units', 'Bookcases', 'Sideboards', 'Coffee Tables',
  'Bedroom', 'Beds', 'Double Beds', 'King Size Beds', 'Storage Beds', 'Guest Beds',
  'Furniture', 'Wardrobes', 'Chest of Drawers', 'Bedside Tables', 'Dressing Tables',
  'Kitchen & Dining', 'Dining', 'Dining Tables', 'Dining Chairs', 'Dining Sets', 'Bar Stools',
  'Kitchen', 'Kitchen Storage', 'Cookware', 'Tableware',
  'Garden & Outdoor', 'Garden Furniture', 'Garden Dining Sets', 'Garden Sofas', 'Sun Loungers',
  'Lighting', 'Indoor', 'Ceiling Lights', 'Floor Lamps', 'Table Lamps', 'Wall Lights'
];

async function compareCategories() {
  console.log('Comparing Hardcoded vs Database Categories...\n');
  
  const dbCategories = await (prisma as any).category.findMany();
  const dbNames = new Set(dbCategories.map((c: any) => c.name.toLowerCase().trim()));

  const report = HARDCODED_NAMES.map(name => {
    const exists = dbNames.has(name.toLowerCase().trim());
    return {
      'Hardcoded Name': name,
      'Status': exists ? '✅ Match' : '❌ Missing in DB',
      'Action Needed': exists ? 'None' : `Create category "${name}"`
    };
  });

  console.table(report);

  const missingCount = report.filter(r => r.Status.includes('Missing')).length;
  if (missingCount > 0) {
    console.log(`\nWarning: ${missingCount} categories in the Megamenu do not exist in the database.`);
    console.log('To fix this, you should run a script to create these missing records.');
  } else {
    console.log('\nAll hardcoded categories are perfectly synced with the database!');
  }

  await prisma.$disconnect();
}

compareCategories().catch(console.error);
