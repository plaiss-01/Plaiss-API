const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testSqlUpdate() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });
  const id = 'b21205d3-df33-45df-9f2d-7b0e3ceec46d';

  try {
    const client = await pool.connect();
    const res = await client.query('UPDATE "Category" SET "isMerged" = true WHERE id = $1 RETURNING name, "isMerged"', [id]);
    console.log('SQL Update success:', res.rows);
    
    // Reset it back
    await client.query('UPDATE "Category" SET "isMerged" = false WHERE id = $1', [id]);
    console.log('Reset success.');
    
    client.release();
  } catch (err) {
    console.error('SQL Update failed:', err.message);
  } finally {
    await pool.end();
  }
}

testSqlUpdate();
