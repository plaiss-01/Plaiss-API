const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://plaissadmin:Plaiss2026Secure!@pg-plaiss-uk.postgres.database.azure.com/plaiss?sslmode=require'
});

async function run() {
  try {
    const res = await pool.query(`SELECT id, name, category, "merchantCategory", "category_name" FROM "Product" WHERE name ILIKE '%Aveley 3 Seater%' LIMIT 10`);
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
