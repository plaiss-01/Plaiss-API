

async function test() {
  const res = await fetch('http://localhost:3001/api/awin/products?limit=24&page=1&category=table');
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    const data = json.data || json;
    
    // Count how many products have 'Chair', 'Table', 'Lamp' etc
    console.log(`Found ${data.length} products`);
    if (data.length > 0) {
      console.table(data.map(p => ({
        name: p.product_name || p.name,
        merchant: p.merchant_name || p.merchant,
        category: p.category_name || p.category,
        categoryId: p.category_id || p.categoryId,
        merchantCategory: p.merchant_category || p.merchantCategory,
        productType: p.product_type || p.productType,
      })));
    }
  } catch (e) {
    console.log("Failed to parse JSON", text);
  }
}

test().catch(console.error);
