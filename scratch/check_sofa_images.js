const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSofaImages() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    const res = await client.query('SELECT name, "imageUrl", "awThumbUrl", "largeImage", "merchantThumbUrl" FROM "Product" WHERE category ILIKE \'%sofa%\' LIMIT 10');
    console.log(`Checking images for 10 products matching 'sofa':`);
    console.table(res.rows);
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSofaImages();
