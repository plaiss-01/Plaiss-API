import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const res = await fetch(`${backendUrl}/api/awin/products?limit=10&search=Velvet%20Chaise%20Longue`);
  if (!res.ok) {
    console.error(`Failed to fetch products: ${res.status}`);
    return;
  }
  const data = await res.json();
  const products = Array.isArray(data) ? data : data.data || [];

  console.log(`Fetched ${products.length} products.`);
  for (const p of products) {
    console.log(`Product: "${p.name}", Variants: ${p.colorVariants?.length || 0}`);
    if (p.colorVariants?.length > 0) {
      console.log('Variants:', p.colorVariants);
    }
  }
}

main();
