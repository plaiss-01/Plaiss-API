const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkDb() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    const res = await client.query('SELECT * FROM "Category" WHERE name ILIKE \'%sofa%\' AND "parentId" IS NULL');
    console.log(`Found ${res.rows.length} root categories matching 'sofa':`);
    console.table(res.rows);
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkDb();
