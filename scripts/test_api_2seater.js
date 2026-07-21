async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/awin/products?category=two-seater');
    const data = await res.json();
    console.log("Total:", data.meta.total);
    for (let i=0; i<Math.min(10, data.data.length); i++) {
      console.log(`Product: ${data.data[i].name} | Cat: ${data.data[i].category} | MerchCat: ${data.data[i].merchantCategory}`);
    }
  } catch (err) {
    console.error(err);
  }
}
run();
