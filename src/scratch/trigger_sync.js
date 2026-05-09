fetch('http://localhost:3001/api/awin/pipeline/promote-prod', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ replace: false, syncProductTable: true })
})
.then(r => r.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
