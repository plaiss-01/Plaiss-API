const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixImages() {
  const url = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url });

  try {
    const client = await pool.connect();
    console.log('✅ Connected.');
    
    // Find products where imageUrl is empty or noimage.gif, but alternateImage or largeImage has a value
    const res = await client.query(`
      UPDATE "Product"
      SET "imageUrl" = COALESCE(NULLIF("largeImage", ''), NULLIF("alternateImage", ''))
      WHERE ("imageUrl" = '' OR "imageUrl" IS NULL OR "imageUrl" LIKE '%noimage.gif%')
      AND (("largeImage" != '' AND "largeImage" IS NOT NULL AND "largeImage" NOT LIKE '%noimage.gif%') 
           OR ("alternateImage" != '' AND "alternateImage" IS NOT NULL AND "alternateImage" NOT LIKE '%noimage.gif%'))
    `);
    
    console.log(`✅ Updated ${res.rowCount} products with valid images from alternate/large sources.`);
    
    client.release();
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixImages();
