import * as fs from 'fs';
import * as path from 'path';

function searchDirectory(dir: string, results: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDirectory(filePath, results);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('function ProductCard') || content.includes('const ProductCard')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

async function main() {
  const results = searchDirectory('d:/Projects/plass/Plaiss/src');
  console.log('Files defining ProductCard:');
  console.log(results);
}

main().catch(console.error);
