import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const productId = '32587812203'; // One of the sample IDs with variants
  const url = `${backendUrl}/api/awin/products/${productId}`;
  
  console.log(`Fetching product from: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Error: ${res.status}`);
      return;
    }
    const data = await res.json();
    console.log('Product Data:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}
run();
