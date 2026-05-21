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
  const tables = ['AWIN_AFFILIAT_PRODUCTS_DATA_PROD', 'Product', 'ProductColorVariant'];
  for (const table of tables) {
    console.log(`\n--- Columns in "${table}" table:`);
    try {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position;
      `, [table]);
      console.table(res.rows);
    } catch (e) {
      console.error(`Error querying columns for table ${table}:`, e.message);
    }
  }
  await pool.end();
}

main().catch(console.error);
