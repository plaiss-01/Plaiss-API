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
  console.log('Checking raw_row for Poltronesofà at SCS...');
  
  const res = await pool.query(`
    SELECT product_name, raw_row
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE merchant_name = 'Poltronesofà at SCS'
    LIMIT 3;
  `);

  res.rows.forEach((row, i) => {
    console.log(`\n--- Product ${i} ---`);
    console.log('Name:', row.product_name);
    console.log('Raw Row:', JSON.stringify(row.raw_row, null, 2));
  });
  
  await pool.end();
}

main().catch(console.error);
