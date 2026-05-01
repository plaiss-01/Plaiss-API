const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'Category\' AND column_name = \'isMerged\'');
    console.log('Column check results:', res.rows);
    
    const sample = await client.query('SELECT id, name, "isMerged" FROM "Category" LIMIT 1');
    console.log('Sample data:', sample.rows);
    
    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
