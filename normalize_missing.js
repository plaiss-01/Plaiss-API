const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 20 // Increase pool size for faster parallel queries
});

const COLORS = [
  'anthracite', 'silver grey', 'stone grey', 'stone', 'natural', 'cream', 
  'off white', 'navy', 'sage', 'bronze', 'copper', 'gold', 'silver', 
  'mustard', 'terracotta', 'rust', 'charcoal', 'slate', 'beige', 
  'burgundy', 'ivory', 'khaki', 'lavender', 'magenta', 'maroon', 
  'mint', 'olive', 'peach', 'periwinkle', 'plum', 'rose', 'tan', 
  'teal', 'turquoise', 'violet', 'amber', 'azure', 'coral', 'cyan', 
  'indigo', 'lemon', 'ochre', 'orchid', 'saffron', 'sepia', 'vermilion',
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'pink', 'brown', 'grey', 'gray'
];

function extractColor(name) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  
  for (const color of COLORS) {
    if (color.includes(' ')) {
      if (lowerName.includes(color)) {
        return color.replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }
  
  for (const color of COLORS) {
    if (!color.includes(' ')) {
      const regex = new RegExp(`\\b${color}\\b`, 'i');
      if (regex.test(lowerName)) {
        return color.replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }
  return null;
}

function extractSize(name) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  
  if (/\bsuper\s*king\b/i.test(lowerName)) return 'Super King';
  if (/\bking\b/i.test(lowerName)) return 'King';
  if (/\bsmall\s*double\b/i.test(lowerName)) return 'Small Double';
  if (/\bdouble\b/i.test(lowerName)) return 'Double';
  if (/\bsingle\b/i.test(lowerName)) return 'Single';
  
  const seaterMatch = name.match(/\b([1-9])\s*(?:seat|seater|seaters)\b/i);
  if (seaterMatch) return `${seaterMatch[1]} Seater`;
  
  if (/\bsofa\s+bed\b|\bsofabed\b/i.test(lowerName)) return 'Sofa Bed';
  
  if (/\bcorner\b|\bl\s*shape\b|\blhf\b|\brhf\b|\bleft hand\b|\bright hand\b|\bchaise\b/i.test(lowerName)) return 'Corner';
  
  return null;
}

async function main() {
  const condition = `
    ("colour" IS NULL OR "colour" = '' OR "colour" = 'Original') 
    OR ("sizeStockStatus" IS NULL OR "sizeStockStatus" = '')
  `;

  console.log('Fetching products to examine...');
  const res = await pool.query(`
    SELECT id, name, colour, "sizeStockStatus"
    FROM "Product" 
    WHERE ${condition}
  `);

  console.log(`Found ${res.rows.length} products to examine.`);
  
  const updates = [];
  
  // 1. Calculate updates in memory first (very fast)
  for (const row of res.rows) {
    let newColor = row.colour;
    let newSize = row.sizeStockStatus;

    if (!row.colour || row.colour === 'Original' || row.colour === '') {
      const extracted = extractColor(row.name);
      if (extracted) newColor = extracted;
    }

    if (!row.sizeStockStatus || row.sizeStockStatus === '') {
      const extracted = extractSize(row.name);
      if (extracted) newSize = extracted;
    }

    if (newColor !== row.colour || newSize !== row.sizeStockStatus) {
      updates.push({ id: row.id, colour: newColor, sizeStockStatus: newSize });
    }
  }

  console.log(`Calculated ${updates.length} products that actually need updates.`);
  
  // 2. Execute updates in chunks of 100 in parallel
  const CHUNK_SIZE = 100;
  let updatedCount = 0;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(u => 
      pool.query(`
        UPDATE "Product"
        SET "colour" = $1, "sizeStockStatus" = $2
        WHERE id = $3
      `, [u.colour, u.sizeStockStatus, u.id])
    ));
    
    updatedCount += chunk.length;
    if (i % 1000 === 0 || i === updates.length - chunk.length) {
      console.log(`Progress: Updated ${updatedCount} / ${updates.length} products...`);
    }
  }

  console.log(`Successfully completed! Updated ${updatedCount} products.`);
  await pool.end();
}

main().catch(console.error);
