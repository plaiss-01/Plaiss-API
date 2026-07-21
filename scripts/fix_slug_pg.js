const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://plaissadmin:Plaiss2026Secure!@pg-plaiss-uk.postgres.database.azure.com/plaiss?sslmode=require'
});

async function run() {
  try {
    const updateRes = await pool.query('UPDATE "Category" SET slug = $1 WHERE id = $2 RETURNING id, slug', ['two-seater', 'cmrt2j28b00000115zh51mz8x']);
    console.log('Updated category:', updateRes.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
