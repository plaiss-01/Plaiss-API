const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to DB');

  await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  console.log('pg_trgm extension ready');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "Product_category_trgm_idx"
    ON "Product" USING GIN (category_name gin_trgm_ops)
  `);
  console.log('Index 1/3 done: category_name');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "Product_merchant_category_trgm_idx"
    ON "Product" USING GIN (merchant_category gin_trgm_ops)
  `);
  console.log('Index 2/3 done: merchant_category');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
    ON "Product" USING GIN (name gin_trgm_ops)
  `);
  console.log('Index 3/3 done: name');

  await client.end();
  console.log('ALL GIN INDEXES CREATED SUCCESSFULLY');
})().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
