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
  const res = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE "size_stock_status_clean" IS NULL OR "size_stock_status_clean" = '') as no_size
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
  `);
  
  console.log('--- Size Results ---');
  console.table(res.rows);
  await pool.end();
}

main().catch(console.error);
