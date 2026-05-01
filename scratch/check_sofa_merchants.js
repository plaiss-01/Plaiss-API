const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSofaMerchants() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    const res = await client.query('SELECT merchant, COUNT(*) FROM "Product" WHERE category ILIKE \'%sofa%\' GROUP BY merchant');
    console.log(`Merchants for 'sofa' products:`);
    console.table(res.rows);
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSofaMerchants();
