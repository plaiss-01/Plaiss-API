const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://plaissadmin:Plaiss2026Secure!@pg-plaiss-uk.postgres.database.azure.com/plaiss?sslmode=require'
});

async function run() {
  try {
    const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    console.log(res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
