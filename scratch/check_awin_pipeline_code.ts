import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.resolve('d:/Projects/plass/Plaiss-API/src/awin/awin.service.ts');
  if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log('--- AWIN Service Pipeline Methods ---');
  let braceCount = 0;
  let capturing = false;
  let linesCaptured = 0;

  lines.forEach((line, index) => {
    if (line.includes('async extractRaw(') || line.includes('async transformDev(') || line.includes('async promoteProd(')) {
      console.log(`\n--- Line ${index + 1}: ${line.trim()} ---`);
      capturing = true;
      linesCaptured = 0;
    }
    if (capturing) {
      console.log(line);
      linesCaptured++;
      if (linesCaptured > 40) {
        console.log('... (truncated) ...');
        capturing = false;
      }
    }
  });
}

main().catch(console.error);
