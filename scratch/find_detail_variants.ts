import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.resolve('d:/Projects/plass/Plaiss/src/features/product/product-detail-client.tsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log('--- Finding colorVariants related lines in product-detail-client.tsx ---');
  lines.forEach((line, index) => {
    if (line.includes('colorVariants') || line.includes('color_name') || line.includes('colour') || line.includes('variant')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

main().catch(console.error);
