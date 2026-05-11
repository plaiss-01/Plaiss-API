import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Step 1: Clearing ProductColorVariant table...');
    await client.query('TRUNCATE TABLE "ProductColorVariant" CASCADE');
    console.log('Cleared ProductColorVariant table!');

    console.log('\nStep 2: Calling API to sync products from PROD table to Product model...');
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${backendUrl}/api/awin/pipeline/sync-product-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!res.ok) {
      console.error(`API Error: ${res.status}`);
      const text = await res.text();
      console.error('Response:', text);
      return;
    }
    console.log('Sync completed successfully via API!');
    
    console.log('\n[SUCCESS] Pipeline reset complete. Ready to run power-dedup.ts!');

  } catch (e) {
    console.error('Error during reset:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
