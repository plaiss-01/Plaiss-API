async function main() {
  const urls = [
    'https://images.productserve.com/preview/107998/40353049440.jpg',
    'https://images2.productserve.com/preview/107998/40353049440.jpg',
    'https://images.productserve.com/preview/107998/40353049440.jpg?w=900&h=900',
    'https://images2.productserve.com/preview/107998/40353049440.jpg?w=900&h=900',
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, { method: 'HEAD' });
      console.log(`URL: ${u}`);
      console.log(`Status: ${res.status} ${res.statusText}, Content-Type: ${res.headers.get('content-type')}, Content-Length: ${res.headers.get('content-length')}`);
    } catch (e: any) {
      console.log(`URL: ${u} - Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
