import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    console.log('Checking for Velvet in Product table...');
    
    const countVelvet = await client.query(`
      SELECT COUNT(*) FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
      WHERE "product_name" ILIKE '%velvet%' OR "description" ILIKE '%velvet%'
    `);
    console.log('Products with "Velvet" in name or description:', countVelvet.rows[0].count);

    console.log('\n--- Unique values of product_model ---');
    const models = await client.query(`
      SELECT "product_model" as val, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE "product_model" IS NOT NULL
      GROUP BY "product_model" 
      ORDER BY count DESC 
      LIMIT 10
    `);
    console.table(models.rows);

    console.log('\n--- Unique values of product_type ---');
    const types = await client.query(`
      SELECT "product_type" as val, COUNT(*) as count
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE "product_type" IS NOT NULL
      GROUP BY "product_type" 
      ORDER BY count DESC 
      LIMIT 10
    `);
    console.table(types.rows);

  } catch (e) {
    console.error('Error during check:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
