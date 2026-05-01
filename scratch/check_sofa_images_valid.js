const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSofaImages() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    const res = await client.query('SELECT name, "imageUrl", "awThumbUrl" FROM "Product" WHERE category ILIKE \'%sofa%\' AND "awThumbUrl" NOT LIKE \'%noimage%\' LIMIT 10');
    console.log(`Checking products matching 'sofa' with potentially valid images:`);
    console.table(res.rows);
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSofaImages();
