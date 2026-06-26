import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.resolve('d:/Projects/plass/Plaiss/src/features/category/category-client.tsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log('--- Finding Product/Card related lines in category-client.tsx ---');
  lines.forEach((line, index) => {
    if (line.includes('colorSwatches') || line.includes('ProductCard') || line.includes('DeliveryBadge') || line.includes('formatPrice')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

main().catch(console.error);
