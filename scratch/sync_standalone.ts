import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AwinService } from '../src/awin/awin.service';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Step 1: Clearing ProductColorVariant table...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE TABLE "ProductColorVariant" CASCADE');
    console.log('Cleared ProductColorVariant table!');
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\nStep 2: Starting NestJS standalone context to run sync...');
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const awinService = app.get(AwinService);
    
    console.log('Running syncProductModelFromAwinProd...');
    // Accessing private method via bracket notation to bypass TypeScript check in script
    await (awinService as any).syncProductModelFromAwinProd();
    console.log('Sync completed successfully!');
    
    await app.close();
    console.log('\n[SUCCESS] Pipeline reset complete. Ready to run power-dedup.ts!');
  } catch (e) {
    console.error('Error during NestJS sync:', e);
  }
}
run();
