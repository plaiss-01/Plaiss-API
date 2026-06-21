const { Client } = require('pg');

const TABLE = '"AWIN_AFFILIAT_PRODUCTS_DATA_PROD"';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to DB');

  const check = await client.query(
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='AWIN_AFFILIAT_PRODUCTS_DATA_PROD'`
  );
  console.log('Table exists:', check.rows[0].count);

  await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  console.log('pg_trgm extension ready');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "prod_category_trgm_idx"
    ON ${TABLE} USING GIN (category_name gin_trgm_ops)
  `);
  console.log('Index 1/3 done: category_name');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "prod_merchant_category_trgm_idx"
    ON ${TABLE} USING GIN (merchant_category gin_trgm_ops)
  `);
  console.log('Index 2/3 done: merchant_category');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "prod_name_trgm_idx"
    ON ${TABLE} USING GIN (product_name gin_trgm_ops)
  `);
  console.log('Index 3/3 done: product_name');

  await client.end();
  console.log('ALL GIN INDEXES CREATED SUCCESSFULLY');
})().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
