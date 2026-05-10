import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    const totalColor = await client.query('SELECT COUNT(*) FROM "ProductColorVariant"');
    console.log('Total Color Variants in DB:', totalColor.rows[0].count);

    const sample = await client.query('SELECT * FROM "ProductColorVariant" LIMIT 5');
    console.table(sample.rows);

  } catch (e) {
    console.error('Error during check:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
