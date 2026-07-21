async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/awin/products?category=two-seater');
    const data = await res.json();
    const aveley = data.data.filter(p => p.name.includes('Aveley'));
    console.log("Aveley products:", aveley.map(a => a.name));
    const kaide = data.data.filter(p => p.name.includes('Kaide'));
    console.log("Kaide products:", kaide.map(a => a.name));
  } catch (err) {
    console.error(err);
  }
}
run();
