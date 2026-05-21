import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  // Test query for category = 'Furnitures' (no subs)
  const uniqueIds = ['cmp801vtf000198ulqdbny8x2', 'cmp8020ih000298ulhfs84gxs', 'cmp80284a000398ul1gzkz87z'];
  const uniqueNames = ['sofas', 'sofa', 'chairs', 'chair', 'tables', 'table', 'Furnitures', 'furniture'];

  const whereFurniture: any = {
    OR: [
      { categoryRel: { id: { in: uniqueIds } } },
      {
        OR: uniqueNames.map((name) => ({
          category: { contains: name, mode: 'insensitive' as const },
        })),
      },
      {
        OR: uniqueNames.map((name) => ({
          merchantCategory: { contains: name, mode: 'insensitive' as const },
        })),
      },
    ]
  };

  const countFurniture = await prisma.product.count({ where: whereFurniture });
  console.log(`Furniture count with new query: ${countFurniture}`);

  // Test query for category = 'Lighting', subs = 'Table'
  const lightingTableIds = ['cmpf4kgwg000101rylitsv2ht'];
  const lightingTableNames: string[] = []; // empty because sub is under lighting

  const whereLightingTable: any = {
    OR: [
      { categoryRel: { id: { in: lightingTableIds } } },
    ]
  };

  // Add lighting exclusions
  const nonLightingTerms = [
    'chair', 'sofa', 'stool', 'bench', 'dining table', 'side table', 
    'coffee table', 'console table', 'dressing table', 'wardrobe', 
    'chest of drawers', 'mattress', 'bed frame', 'rug', 'pouffe', 
    'bar table', 'bistro table', 'bedside', 'ottoman'
  ];
  const notConditions = nonLightingTerms.map(term => ({
    name: { contains: term, mode: 'insensitive' as const }
  }));
  whereLightingTable.AND = [{ NOT: { OR: notConditions } }];

  const countLightingTable = await prisma.product.count({ where: whereLightingTable });
  console.log(`Lighting Table count with new query: ${countLightingTable}`);
}

test().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
