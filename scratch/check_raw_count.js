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
  console.log('Checking count in RAW table...');
  
  // Need to find the name of the RAW table. Usually it is mentioned in the code or schema.
  // Let's assume it is "AWIN_AFFILIAT_PRODUCTS_DATA" or similar.
  // Let's check the tables in the database first or try a common name.
  
  try {
    const res = await pool.query(`
      SELECT COUNT(*) as count 
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA";
    `);
    console.log('Count in AWIN_AFFILIAT_PRODUCTS_DATA:', res.rows[0].count);
  } catch (err) {
    console.log('Error querying AWIN_AFFILIAT_PRODUCTS_DATA:', err.message);
  }

  try {
    const res = await pool.query(`
      SELECT COUNT(*) as count 
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_RAW";
    `);
    console.log('Count in AWIN_AFFILIAT_PRODUCTS_DATA_RAW:', res.rows[0].count);
  } catch (err) {
    console.log('Error querying AWIN_AFFILIAT_PRODUCTS_DATA_RAW:', err.message);
  }
  
  await pool.end();
}

main().catch(console.error);
