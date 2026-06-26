async function main() {
  const urls = [
    'https://cdn.shopify.com/s/files/1/0860/7760/4174/files/10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg?v=1732657354',
    'https://cdn.shopify.com/s/files/1/0860/7760/4174/files/10_c9052cb3-2294-4f55-b83c-408489bccad6.jpg?v=1732657354',
    'https://cdn.shopify.com/s/files/1/0860/7760/4174/files/10_f3973290-7c47-47cd-bacb-6e593f3f1094.jpg?v=1732657354',
    'https://cdn.shopify.com/s/files/1/0860/7760/4174/files/10_ba62ac3f-f84a-409d-8487-fee9bf93d4c8.png?v=1732657354',
    'https://images2.productserve.com/?w=70&h=70&bg=white&trim=5&t=letterbox&url=ssl%3Acdn.shopify.com%2Fs%2Ffiles%2F1%2F0860%2F7760%2F4174%2Ffiles%2F10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg%3Fv%3D1732657354&feedId=99953&k=bc2482986d23162b78166179217a32ec16a5c5a7',
    'https://images.productserve.com/preview/3353/12345.jpg?w=900&h=900&bg=white&t=letterbox&url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2F1%2F0860%2F7760%2F4174%2Ffiles%2F10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg%3Fv%3D1732657354'
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
