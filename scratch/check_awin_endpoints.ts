import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.resolve('d:/Projects/plass/Plaiss-API/src/awin/awin.controller.ts');
  if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log('--- AWIN Controller Endpoints ---');
  let currentRoute = '';
  lines.forEach((line, index) => {
    if (line.includes('@Controller')) {
      console.log(`Controller Path: ${line.trim()}`);
    }
    if (line.includes('@Post(') || line.includes('@Get(') || line.includes('@Delete(') || line.includes('@Put(')) {
      currentRoute = line.trim();
    }
    if (line.includes('async ') && currentRoute) {
      console.log(`Line ${index + 1}: ${currentRoute} -> ${line.trim()}`);
      currentRoute = '';
    }
  });
}

main().catch(console.error);
