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
  try {
    const prodRes = await pool.query(`
      SELECT count(*)::int as count 
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
         OR category_name ILIKE '%light%'
         OR category_name ILIKE '%lamp%'
    `);
    
    console.log(`Products matching condition: ${prodRes.rows[0].count}`);

  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}

main().catch(console.error);
