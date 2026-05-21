const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const lightingCategories = [
    'Lighting', 'Wall', 'Floor', 'Table', 'Lamp',
    'Wall Lights', 'Spotlight Bulbs', 'String Lights', 
    'Floor Lamps', 'Table Lamps', 'Stake Lights', 
    'GU10 - Spotlight Cap Fitting', 'Indoor Christmas Lights', 
    'Lamp Shades', 'Touch Lamps'
  ];

  try {
    const placeholders = lightingCategories.map((_, i) => `$${i + 1}`).join(', ');

    // Count products
    const prodCountRes = await pool.query(
      `SELECT count(*)::int as count 
       FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
       WHERE category_name IN (${placeholders})`,
      lightingCategories
    );
    
    // Count variants
    const varCountRes = await pool.query(
      `SELECT count(*)::int as count 
       FROM "ProductColorVariant" 
       WHERE product_id IN (
         SELECT aw_product_id 
         FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
         WHERE category_name IN (${placeholders})
       )`,
      lightingCategories
    );

    console.log(`Products to delete: ${prodCountRes.rows[0].count}`);
    console.log(`Variants to delete: ${varCountRes.rows[0].count}`);

  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}

main().catch(console.error);
