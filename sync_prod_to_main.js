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
  console.log('Starting full database sync from PROD table to main Product table...');

  try {
    console.log('Clearing old data in Product table...');
    await pool.query('TRUNCATE "Product" CASCADE;');

    console.log('Inserting fresh data from AWIN_AFFILIAT_PRODUCTS_DATA_PROD...');
    
    const query = `
      INSERT INTO "Product" (
        id, 
        name, 
        slug, 
        description, 
        price, 
        currency, 
        "imageUrl", 
        "productUrl", 
        merchant, 
        category, 
        "merchantCategory", 
        "categoryId", 
        "brandName", 
        colour, 
        "productModel", 
        "productType", 
        "sizeStockStatus", 
        "merchantProductId", 
        saving, 
        "rrpPrice",
        "createdAt",
        "updatedAt"
      ) 
      SELECT 
        aw_product_id, 
        product_name, 
        slug, 
        description, 
        search_price, 
        currency, 
        image_url, 
        product_url, 
        merchant_name, 
        category_name, 
        merchant_category, 
        category_id, 
        brand_name, 
        colour_clean, 
        product_model_clean, 
        product_type, 
        size_stock_status_clean, 
        merchant_product_id, 
        saving, 
        original_price_clean,
        NOW(),
        NOW()
      FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD";
    `;

    const res = await pool.query(query);
    console.log(`Successfully synced ${res.rowCount} products!`);
    
  } catch (e) {
    console.error('Error during sync:', e.message);
  }

  await pool.end();
}

main().catch(console.error);
