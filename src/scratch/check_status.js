const jobId = 'awin-promote-prod-1778319301561';
fetch(`http://localhost:3001/api/awin/import-status/${jobId}`)
.then(r => r.text())
.then(data => {
  console.log('Raw response:', data);
  try {
    const json = JSON.parse(data);
    console.log('Status:', json);
  } catch(e) {
    console.log('(Could not parse as JSON)');
  }
})
.catch(err => console.error('Error:', err));
