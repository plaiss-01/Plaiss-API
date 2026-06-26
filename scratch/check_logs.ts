import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== Checking Logs for Awin Pipeline Errors ===\n');

  const logFiles = [
    'api-dev-server.log',
    'api-dev-server-2.log',
    'api-dev-server-3.log',
    'api-direct-server.log'
  ];

  for (const file of logFiles) {
    const filePath = path.resolve('d:/Projects/plass/Plaiss-API', file);
    if (!fs.existsSync(filePath)) {
      console.log(`Log file ${file} does not exist.`);
      continue;
    }

    console.log(`Scanning ${file}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let errorCount = 0;
    const matchingLines: string[] = [];

    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      if ((lower.includes('error') || lower.includes('fail') || lower.includes('exception')) && 
          (lower.includes('awin') || lower.includes('pipeline') || lower.includes('dedup') || lower.includes('promote') || lower.includes('transform'))) {
        errorCount++;
        if (matchingLines.length < 15) {
          matchingLines.push(`  Line ${index + 1}: ${line.trim()}`);
        }
      }
    });

    console.log(`Found ${errorCount} matching lines in ${file}.`);
    if (matchingLines.length > 0) {
      console.log('First few matches:');
      matchingLines.forEach(l => console.log(l));
    }
    console.log();
  }
}

main().catch(console.error);
