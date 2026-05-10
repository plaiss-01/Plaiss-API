import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const keywords = [
  'Faux Leather',
  'Velvet',
  'Chenille',
  'Boucle',
  'Linen',
  'Polyester',
  'Leather',
  'Fabric'
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('Fetching products...');
    const res = await client.query(`
      SELECT "aw_product_id" as id, "product_name" as name, "description", "product_model_clean" as current_material
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    `);
    
    console.log(`Found ${res.rows.length} products.`);
    let updatedCount = 0;

    for (const row of res.rows) {
      const text = `${row.name} ${row.description || ''}`.toLowerCase();
      let detectedMaterial: string | null = null;

      // Check keywords in order of priority
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          detectedMaterial = keyword;
          break; // Stop at the first (highest priority) match
        }
      }

      // If we detected a material and it's different from the current one, update it
      // Or if the current one is 'Unknown' or null
      if (detectedMaterial && 
          (row.current_material !== detectedMaterial || row.current_material === 'Unknown' || !row.current_material)) {
        
        await client.query(`
          UPDATE "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
          SET "product_model_clean" = $1
          WHERE "aw_product_id" = $2
        `, [detectedMaterial, row.id]);
        
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} products with extracted materials.`);

    // Show new counts
    const newCounts = await client.query(`
      SELECT "product_model_clean" as val, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE "product_model_clean" IS NOT NULL
      GROUP BY "product_model_clean" 
      ORDER BY count DESC
    `);
    console.log('\n--- New Material Facets ---');
    console.table(newCounts.rows);

  } catch (e) {
    console.error('Error during execution:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
