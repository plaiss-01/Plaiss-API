const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function addColumn() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    await client.query('ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isMerged" BOOLEAN DEFAULT false');
    console.log('✅ Column "isMerged" added successfully.');
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

addColumn();
