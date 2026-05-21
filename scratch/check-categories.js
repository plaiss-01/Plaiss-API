const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
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
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, name, slug, "parentId", "isAwin" FROM "Category"');
    console.log("All categories in DB:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
  }
  await pool.end();
}

main();
