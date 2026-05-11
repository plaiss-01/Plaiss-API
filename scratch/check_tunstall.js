require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const res = await pool.query(`
    SELECT "aw_product_id" as id, "product_name" as name, "merchant_name" as merchant, "brand_name" as brandname, "raw_row" as rawrow
    FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
    WHERE "product_name" ILIKE '%TUNSTALL%'
  `);

  console.log('Found products:', res.rows.length);
  res.rows.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Merchant: ${p.merchant}`);
    console.log(`BrandName: ${p.brandname}`);
    if (p.rawrow) {
      try {
        const raw = JSON.parse(p.rawrow);
        console.log(`Raw Merchant: ${raw.merchant_name}`);
        console.log(`Raw Brand: ${raw.brand_name}`);
      } catch (e) {
        console.log('Raw row parse error');
      }
    }
    console.log('-------------------');
  });

  await pool.end();
}

main().catch(e => console.error(e));
