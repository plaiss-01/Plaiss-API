async function test() {
  const res = await fetch('http://localhost:3001/api/awin/products?limit=24&page=1&category=Lighting&subs=Wall%2CFloor%2CTable%2CLamp');
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    const data = json.data || json;
    
    // Count retailers
    const retailers = new Set(data.map((p: any) => p.merchant));
    console.log('Retailers found in first 24 results:', Array.from(retailers));

    // Print first product from a bad retailer
    const bad = data.find((p: any) => p.merchant !== 'Lights.co.uk' && p.merchant !== 'The Range');
    if (bad) {
      console.log('Bad product found:', {
        name: bad.name,
        merchant: bad.merchant,
        category: bad.category,
        merchantCategory: bad.merchantCategory,
        categoryId: bad.categoryId
      });
    } else {
      console.log('No bad products found in first 24 results.');
    }
  } catch (e) {
    console.log('Error parsing response:', e);
  }
}

test();
