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
  const categoriesToCheck = ['Wall', 'Floor', 'Table', 'Lamp'];
  
  try {
    for (const cat of categoriesToCheck) {
      console.log(`\n--- Samples for category_name = '${cat}':`);
      const res = await pool.query(
        `SELECT aw_product_id, product_name, category_name, product_type, description 
         FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
         WHERE category_name = $1 
         LIMIT 3`,
        [cat]
      );
      for (const row of res.rows) {
        console.log(`  ID: ${row.aw_product_id}`);
        console.log(`  Name: ${row.product_name}`);
        console.log(`  Type: ${row.product_type}`);
        console.log(`  Desc: ${row.description ? row.description.substring(0, 100) + '...' : 'N/A'}`);
        console.log('  ------------------');
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}

main().catch(console.error);
