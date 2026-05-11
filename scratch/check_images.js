const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
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
  console.log('Checking images in AWIN_AFFILIAT_PRODUCTS_DATA_PROD...');
  
  const res = await pool.query(`
    SELECT product_name, image_url, merchant_name
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE image_url IS NOT NULL AND image_url != ''
    LIMIT 10;
  `);

  console.log('--- Sample Products Image Check ---');
  console.table(res.rows);
  
  const countRes = await pool.query(`
    SELECT COUNT(*) as count 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE image_url IS NULL OR image_url = '';
  `);
  
  console.log('\nTotal products missing images:', countRes.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
