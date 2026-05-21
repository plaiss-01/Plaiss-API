const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
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
  console.log('Starting deletion of existing lighting products from database...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete from ProductColorVariant first (due to referencing productId in AWIN_AFFILIAT_PRODUCTS_DATA_PROD)
    console.log('Deleting variants from ProductColorVariant...');
    const deleteVariantsRes = await client.query(`
      DELETE FROM "ProductColorVariant" 
      WHERE product_id IN (
        SELECT aw_product_id 
        FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
        WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
           OR category_name ILIKE '%light%'
           OR category_name ILIKE '%lamp%'
      )
    `);
    console.log(`Deleted ${deleteVariantsRes.rowCount} variants from ProductColorVariant.`);

    // 2. Delete from AWIN_AFFILIAT_PRODUCTS_DATA_PROD
    console.log('Deleting products from AWIN_AFFILIAT_PRODUCTS_DATA_PROD...');
    const deleteProdRes = await client.query(`
      DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
         OR category_name ILIKE '%light%'
         OR category_name ILIKE '%lamp%'
    `);
    console.log(`Deleted ${deleteProdRes.rowCount} products from AWIN_AFFILIAT_PRODUCTS_DATA_PROD.`);

    // 3. Delete from AWIN_AFFILIAT_PRODUCTS_DATA_DEV (just in case)
    console.log('Deleting products from AWIN_AFFILIAT_PRODUCTS_DATA_DEV...');
    const deleteDevRes = await client.query(`
      DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_DEV" 
      WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
         OR category_name ILIKE '%light%'
         OR category_name ILIKE '%lamp%'
    `);
    console.log(`Deleted ${deleteDevRes.rowCount} products from AWIN_AFFILIAT_PRODUCTS_DATA_DEV.`);

    await client.query('COMMIT');
    console.log('\nDatabase transaction committed successfully. All lighting products have been removed.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error during deletion transaction, rolled back changes:', e.message);
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(console.error);
