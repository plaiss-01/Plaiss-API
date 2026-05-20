async function test() {
  const res = await fetch('http://localhost:3001/api/awin/products?category=Lighting&types=Table&limit=10');
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    const data = json.data || json;
    
    console.log(`Found ${data.length} products`);
    if (data.length > 0) {
      console.table(data.map((p: any) => ({
        name: p.name.substring(0, 30),
        merchant: p.merchant,
        category: p.category,
        categoryId: p.categoryId,
        merchantCategory: p.merchantCategory,
        productType: p.productType
      })));
    }
  } catch (e) {
    console.log('Error parsing response:', e);
  }
}

test();
