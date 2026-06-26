import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.resolve('d:/Projects/plass/Plaiss/src/features/category/category-client.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (line.includes('getColorHex')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

main().catch(console.error);
