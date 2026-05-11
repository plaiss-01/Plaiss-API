const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  console.log('Checking and deleting broken images for Cheap Furniture Warehouse...');
  
  const res = await pool.query(`
    SELECT aw_product_id, product_name, image_url
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
    WHERE merchant_name = 'Cheap Furniture Warehouse';
  `);

  console.log(`Found ${res.rows.length} products. Checking URLs...`);

  for (const row of res.rows) {
    const url = row.image_url;
    if (!url) {
      console.log(`Product ${row.aw_product_id} has no URL. Skipping.`);
      continue;
    }

    try {
      console.log(`Checking ${url} ...`);
      const response = await fetch(url, { method: 'HEAD' }); // Use HEAD to save bandwidth
      
      if (response.status === 404) {
        console.log(`-> 404 detected! Deleting product ${row.aw_product_id} (${row.product_name})...`);
        await pool.query(`
          DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
          WHERE aw_product_id = $1
        `, [row.aw_product_id]);
        console.log('-> Deleted.');
      } else {
        console.log(`-> Status ${response.status}. Keeping.`);
      }
    } catch (err) {
      console.log(`-> Error checking URL: ${err.message}. Skipping.`);
    }
  }
  
  await pool.end();
}

main().catch(console.error);
