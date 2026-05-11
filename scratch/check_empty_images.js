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
  console.log('Checking products with missing or placeholder images...');
  
  const res = await pool.query(`
    SELECT COUNT(*) as count 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE image_url IS NULL 
       OR image_url = '' 
       OR image_url LIKE '%noimage%' 
       OR image_url LIKE '%no_image%';
  `);

  console.log('Total products with missing/placeholder images:', res.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
