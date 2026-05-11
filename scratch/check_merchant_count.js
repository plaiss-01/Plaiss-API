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
  console.log('Checking product count for Cheap Furniture Warehouse...');
  
  const res = await pool.query(`
    SELECT COUNT(*) as count 
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE merchant_name = 'Cheap Furniture Warehouse';
  `);

  console.log('Total products for Cheap Furniture Warehouse:', res.rows[0].count);
  
  await pool.end();
}

main().catch(console.error);
