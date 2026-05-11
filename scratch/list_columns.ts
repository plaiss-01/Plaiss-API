import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Product'
    `);
    console.log('Columns in Product table:');
    console.log(res.rows.map(r => r.column_name));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
