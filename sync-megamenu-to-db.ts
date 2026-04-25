
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

const MEGA_MENU_STRUCTURE = [
  {
    name: 'Living Room',
    children: [
      { name: 'Seating', children: ['Sofas', 'Armchairs', 'Corner Sofas', 'Footstools'] },
      { name: 'Storage', children: ['TV Units', 'Bookcases', 'Sideboards', 'Coffee Tables'] }
    ]
  },
  {
    name: 'Bedroom',
    children: [
      { name: 'Beds', children: ['Double Beds', 'King Size Beds', 'Storage Beds', 'Guest Beds'] },
      { name: 'Furniture', children: ['Wardrobes', 'Chest of Drawers', 'Bedside Tables', 'Dressing Tables'] }
    ]
  },
  {
    name: 'Kitchen & Dining',
    children: [
      { name: 'Dining', children: ['Dining Tables', 'Dining Chairs', 'Dining Sets', 'Bar Stools'] },
      { name: 'Kitchen', children: ['Kitchen Storage', 'Cookware', 'Tableware'] }
    ]
  },
  {
    name: 'Garden & Outdoor',
    children: [
      { name: 'Garden Furniture', children: ['Garden Dining Sets', 'Garden Sofas', 'Sun Loungers'] }
    ]
  },
  {
    name: 'Lighting',
    children: [
      { name: 'Indoor', children: ['Ceiling Lights', 'Floor Lamps', 'Table Lamps', 'Wall Lights'] }
    ]
  }
];

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function syncMenu() {
  console.log('Syncing Megamenu structure to Database...\n');

  for (const root of MEGA_MENU_STRUCTURE) {
    // 1. Ensure Root exists
    let rootRecord = await (prisma as any).category.findFirst({ 
      where: { name: { equals: root.name, mode: 'insensitive' } } 
    });
    
    if (!rootRecord) {
      rootRecord = await (prisma as any).category.create({
        data: { name: root.name, slug: slugify(root.name), isAwin: false }
      });
      console.log(`+ Created Root: ${root.name}`);
    } else {
      // Ensure slug is correct
      rootRecord = await (prisma as any).category.update({
        where: { id: rootRecord.id },
        data: { slug: slugify(root.name), parentId: null }
      });
    }

    // 2. Process Mid-level Categories (e.g., Seating, Storage)
    for (const mid of root.children) {
      let midRecord = await (prisma as any).category.findFirst({ 
        where: { name: { equals: mid.name, mode: 'insensitive' } } 
      });

      if (!midRecord) {
        midRecord = await (prisma as any).category.create({
          data: { name: mid.name, slug: slugify(mid.name), parentId: rootRecord.id, isAwin: false }
        });
        console.log(`  + Created Mid: ${mid.name} (under ${root.name})`);
      } else {
        midRecord = await (prisma as any).category.update({
          where: { id: midRecord.id },
          data: { slug: slugify(mid.name), parentId: rootRecord.id }
        });
      }

      // 3. Process Leaves (e.g., Sofas, Armchairs)
      for (const leafName of mid.children) {
        let leafRecord = await (prisma as any).category.findFirst({ 
          where: { name: { equals: leafName, mode: 'insensitive' } } 
        });

        if (!leafRecord) {
          leafRecord = await (prisma as any).category.create({
            data: { name: leafName, slug: slugify(leafName), parentId: midRecord.id, isAwin: false }
          });
          console.log(`    + Created Leaf: ${leafName} (under ${mid.name})`);
        } else {
          leafRecord = await (prisma as any).category.update({
            where: { id: leafRecord.id },
            data: { slug: slugify(leafName), parentId: midRecord.id }
          });
        }
      }
    }

  }

  console.log('\nSync complete! All Megamenu categories now exist in the database.');
  await prisma.$disconnect();
}

syncMenu().catch(console.error);
