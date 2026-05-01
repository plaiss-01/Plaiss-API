const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkId() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });
  const id = 'b21205d3-df33-45df-9f2d-7b0e3ceec46d';

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT name FROM "Category" WHERE id = $1', [id]);
    console.log('Result:', res.rows);
    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkId();
