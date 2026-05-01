const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function findAnyImageUrl() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    const res = await client.query(`
      SELECT 
        "imageUrl", "awThumbUrl", "largeImage", "alternateImage", "custom1", "custom2", "custom3", "custom4"
      FROM "Product" 
      WHERE merchant = 'Poltronesofà at SCS' 
      LIMIT 1
    `);
    
    console.log('Sample columns for Poltronesofà at SCS:');
    console.dir(res.rows[0], { depth: null });
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

findAnyImageUrl();
