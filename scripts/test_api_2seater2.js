async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/awin/products?category=two-seater&limit=1000');
    const data = await res.json();
    console.log("Total:", data.meta.total);
    const kaide = data.data.find(p => p.name.includes('Kaide'));
    console.log("Is Kaide in the response?", !!kaide);
    const aveley = data.data.find(p => p.name.includes('Aveley'));
    console.log("Is Aveley in the response?", !!aveley);
  } catch (err) {
    console.error(err);
  }
}
run();
