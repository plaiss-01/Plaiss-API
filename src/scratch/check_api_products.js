fetch('http://localhost:3001/api/awin/products?category=Sofas&limit=5')
.then(r => r.json())
.then(data => {
  console.log('Sofas from API:');
  data.data.forEach(p => {
    console.log(`- ${p.name}: imageUrl="${p.imageUrl}", image="${p.image}"`);
    console.log(`  largeImage="${p.largeImage}", awThumbUrl="${p.awThumbUrl}"`);
  });
})
.catch(err => console.error(err));
