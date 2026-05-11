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
  console.log('Clearing all products data from PROD table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete all rows (less locking than TRUNCATE)
    await client.query('DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD";');
    
    await client.query('COMMIT');
    console.log('All product data cleared successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to clear data:', e.message);
  } finally {
    client.release();
  }
  
  await pool.end();
}

main().catch(console.error);
