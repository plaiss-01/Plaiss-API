const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const { v4: uuidv4 } = require('uuid');

const envPath = path.join(__dirname, '.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const match = envFile.match(/^DATABASE_URL=["']?(.+?)["']?$/m);
  if (match) {
    databaseUrl = match[1];
  }
}

const pool = new Pool({ connectionString: databaseUrl });

// Colors list for Method C deduplication
const colors = [
  'grey', 'gray', 'cream', 'blue', 'navy', 'black', 'white', 'red', 'green', 'yellow', 
  'pink', 'purple', 'orange', 'brown', 'beige', 'teal', 'silver', 'gold', 'charcoal', 'anthracite'
];
const colorPattern = new RegExp('\\b(' + colors.join('|') + ')\\b', 'gi');

function cleanCoreName(name) {
  if (!name) return '';
  let cleaned = name.toLowerCase();
  cleaned = cleaned.replace(colorPattern, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 5) {
    cleaned = name.toLowerCase().trim();
  }
  return cleaned;
}

function parseCleanPrice(value) {
  if (value === undefined || value === null) return null;
  const parsed = parseFloat(String(value).replace(/,/g, '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

const standardColourMap = {
  black: 'Black',
  white: 'White',
  'off white': 'White',
  'off-white': 'White',
  'snow white': 'White',
  'optical white': 'White',
  grey: 'Grey',
  gray: 'Grey',
  'light grey': 'Grey',
  'dark grey': 'Grey',
  'medium grey': 'Grey',
  'silver grey': 'Grey',
  silver: 'Grey',
  steel: 'Grey',
  ash: 'Grey',
  fossil: 'Grey',
  stone: 'Grey',
  iron: 'Grey',
  slate: 'Grey',
  pewter: 'Grey',
  dove: 'Grey',
  chalk: 'Grey',
  cloud: 'Grey',
  charcoal: 'Grey',
  anthracite: 'Grey',
  brown: 'Brown',
  'dark brown': 'Brown',
  chocolate: 'Brown',
  tan: 'Brown',
  saddle: 'Brown',
  cognac: 'Brown',
  'dark cognac': 'Brown',
  caramel: 'Brown',
  mocha: 'Brown',
  latte: 'Brown',
  rust: 'Brown',
  wenge: 'Brown',
  walnut: 'Brown',
  oak: 'Brown',
  truffle: 'Brown',
  biscuit: 'Brown',
  taupe: 'Brown',
  beige: 'Beige',
  'light beige': 'Beige',
  'medium beige': 'Beige',
  'dark beige': 'Beige',
  cream: 'Beige',
  ivory: 'Beige',
  natural: 'Beige',
  sahara: 'Beige',
  greige: 'Beige',
  blue: 'Blue',
  'light blue': 'Blue',
  'dark blue': 'Blue',
  'midnight blue': 'Blue',
  navy: 'Blue',
  azul: 'Blue',
  teal: 'Blue',
  turquoise: 'Blue',
  denim: 'Blue',
  peacock: 'Blue',
  green: 'Green',
  'acid green': 'Green',
  olive: 'Green',
  red: 'Red',
  ruby: 'Red',
  wine: 'Red',
  yellow: 'Yellow',
  mustard: 'Yellow',
  ochre: 'Yellow',
  sunflower: 'Yellow',
  orange: 'Orange',
  cinnamon: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  gold: 'Gold',
  multicoloured: 'Multicolour',
  multicolored: 'Multicolour',
  'multi coloured': 'Multicolour',
  'multi colored': 'Multicolour',
};

function detectStandardColour(text) {
  if (!text) return 'Unknown';
  const coloursSorted = Object.keys(standardColourMap).sort((a, b) => b.length - a.length);
  for (const rawColour of coloursSorted) {
    const escaped = rawColour.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      return standardColourMap[rawColour];
    }
  }
  return 'Unknown';
}

function inferColour(row) {
  const fields = [
    'colour',
    'color',
    'product_name',
    'description',
    'product_type',
    'merchant_product_category_path',
    'merchant_product_second_category',
    'merchant_product_third_category',
    'merchant_deep_link',
    'merchant_product_id',
    'custom_1',
    'custom_2',
    'custom_3',
  ];

  for (const field of fields) {
    const val = row[field];
    if (val) {
      const detected = detectStandardColour(val);
      if (detected !== 'Unknown') return detected;
    }
  }
  return 'N/A';
}

function slugify(text, suffix) {
  if (!text) return `product-${suffix || Date.now()}`;
  const slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return suffix ? `${slug}-${suffix}` : slug;
}

function getImageUrl(row) {
  const imageKeys = ['merchant_image_url', 'large_image', 'aw_image_url', 'image_url', 'alternate_image', 'aw_thumb_url'];
  for (const key of imageKeys) {
    const val = row[key];
    if (val && !val.includes('noimage.gif') && !val.includes('no_image')) {
      return val.replace('http://', 'https://');
    }
  }
  return (row['merchant_image_url'] || row['image_url'] || '').replace('http://', 'https://');
}

function determineCategory(row) {
  const type = row.product_type || '';
  const path = row.merchant_product_category_path || row.merchant_category || '';
  const text = (type + ' ' + path).toLowerCase();
  
  if (/\bwall\b/i.test(text)) return 'Wall';
  if (/\bfloor\b/i.test(text)) return 'Floor';
  if (/\btable\b/i.test(text)) return 'Table';
  if (/\blamp\b/i.test(text)) return 'Lamp';
  return 'Lighting';
}

async function main() {
  const csvFilePath = path.join(__dirname, '..', 'Plaiss', 'Lighting new_updated.csv');
  console.log(`Reading CSV from ${csvFilePath}...`);

  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    process.exit(1);
  }

  const allSelectedRows = [];

  const stream = fs.createReadStream(csvFilePath);
  const parser = stream.pipe(csv.parse({ headers: true }));

  for await (const row of parser) {
    if (row.Selection === '1' || row.selection === '1') {
      allSelectedRows.push(row);
    }
  }

  console.log(`Successfully parsed CSV. Total rows matching Selection = 1: ${allSelectedRows.length}`);

  // Group by Method C core name
  console.log('Grouping products by core name...');
  const groups = {};
  for (const row of allSelectedRows) {
    const name = row.product_name || '';
    const coreName = cleanCoreName(name);
    if (!groups[coreName]) {
      groups[coreName] = [];
    }
    groups[coreName].push(row);
  }

  const masterProducts = [];
  const variantProducts = [];

  for (const coreName in groups) {
    const group = groups[coreName];
    // Sort by description length descending
    group.sort((a, b) => (b.description || '').length - (a.description || '').length);

    const master = group[0];
    masterProducts.push(master);

    // Any other items in the group are variants
    for (let i = 1; i < group.length; i++) {
      variantProducts.push({
        variant: group[i],
        masterId: master.aw_product_id
      });
    }
  }

  console.log(`Deduplication results:`);
  console.log(`- Master Products to insert: ${masterProducts.length}`);
  console.log(`- Variant Products to insert: ${variantProducts.length}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Ensuring clean slate for lighting products...');
    await client.query(`
      DELETE FROM "ProductColorVariant" 
      WHERE product_id IN (
        SELECT aw_product_id 
        FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
        WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
      )
    `);
    await client.query(`
      DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
      WHERE category_name IN ('Lighting', 'Wall', 'Floor', 'Table', 'Lamp')
    `);

    // Batch insert master products
    console.log('Inserting master products in batches...');
    const batchSize = 500;
    for (let i = 0; i < masterProducts.length; i += batchSize) {
      const batch = masterProducts.slice(i, i + batchSize);
      console.log(`Inserting master products batch ${i / batchSize + 1} (${batch.length} products)...`);

      // We can construct a bulk insert statement
      const values = [];
      const valuePlaceholders = [];
      let paramIndex = 1;

      for (const row of batch) {
        const awProductId = row.aw_product_id;
        const productName = row.product_name;
        const price = parseCleanPrice(row.search_price) || 0;
        const imageUrl = getImageUrl(row);
        const productUrl = row.aw_deep_link || row.product_url;
        const categoryName = determineCategory(row);
        const originalPriceClean = parseCleanPrice(row.rrp_price || row.base_price || row.product_price_old) || null;
        const discountedPriceClean = parseCleanPrice(row.display_price || row.search_price || row.store_price) || null;
        const saving = (originalPriceClean && discountedPriceClean && originalPriceClean - discountedPriceClean >= 5) ? (originalPriceClean - discountedPriceClean) : 0;
        const colourClean = inferColour(row);

        const params = [
          awProductId, // 1
          row.merchant_product_id || null, // 2
          productName, // 3
          slugify(productName, awProductId), // 4
          row.description || null, // 5
          price, // 6
          row.currency || 'GBP', // 7
          imageUrl, // 8
          productUrl, // 9
          row.merchant_name || null, // 10
          categoryName, // 11
          row.merchant_category || null, // 12
          row.category_id || null, // 13
          row.brand_name || null, // 14
          row.colour || null, // 15
          row.product_model || null, // 16
          row.product_type || null, // 17
          null, // product_model_clean: 18
          colourClean, // colour_clean: 19
          null, // size_stock_status_clean: 20
          'No', // is_recliner: 21
          'No', // is_sofa_bed: 22
          row.parent_product_id || row.aw_product_id, // base_sku: 23
          null, // colour_variant_number: 24
          originalPriceClean, // 25
          discountedPriceClean, // 26
          saving, // 27
          saving >= 5 ? 'Yes' : 'No', // sales_discount: 28
          JSON.stringify(row), // raw_row: 29
          new Date(), // transformed_at: 30
          new Date() // loaded_at: 31
        ];

        values.push(...params);
        const placeholders = [];
        for (let p = 0; p < params.length; p++) {
          placeholders.push(`$${paramIndex++}`);
        }
        valuePlaceholders.push(`(${placeholders.join(', ')})`);
      }

      const query = `
        INSERT INTO "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" (
          aw_product_id, merchant_product_id, product_name, slug, description,
          search_price, currency, image_url, product_url, merchant_name,
          category_name, merchant_category, category_id, brand_name, colour,
          product_model, product_type, product_model_clean, colour_clean,
          size_stock_status_clean, is_recliner, is_sofa_bed, base_sku,
          colour_variant_number, original_price_clean, discounted_price_clean,
          saving, sales_discount, raw_row, transformed_at, loaded_at
        ) VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (aw_product_id) DO UPDATE SET
          merchant_product_id = EXCLUDED.merchant_product_id,
          product_name = EXCLUDED.product_name,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          search_price = EXCLUDED.search_price,
          currency = EXCLUDED.currency,
          image_url = EXCLUDED.image_url,
          product_url = EXCLUDED.product_url,
          merchant_name = EXCLUDED.merchant_name,
          category_name = EXCLUDED.category_name,
          merchant_category = EXCLUDED.merchant_category,
          category_id = EXCLUDED.category_id,
          brand_name = EXCLUDED.brand_name,
          colour = EXCLUDED.colour,
          product_model = EXCLUDED.product_model,
          product_type = EXCLUDED.product_type,
          product_model_clean = EXCLUDED.product_model_clean,
          colour_clean = EXCLUDED.colour_clean,
          size_stock_status_clean = EXCLUDED.size_stock_status_clean,
          is_recliner = EXCLUDED.is_recliner,
          is_sofa_bed = EXCLUDED.is_sofa_bed,
          base_sku = EXCLUDED.base_sku,
          original_price_clean = EXCLUDED.original_price_clean,
          discounted_price_clean = EXCLUDED.discounted_price_clean,
          saving = EXCLUDED.saving,
          sales_discount = EXCLUDED.sales_discount,
          raw_row = EXCLUDED.raw_row,
          transformed_at = EXCLUDED.transformed_at,
          loaded_at = EXCLUDED.loaded_at;
      `;

      await client.query(query, values);
    }

    // Batch insert variant products
    console.log('Inserting variant products in batches...');
    for (let i = 0; i < variantProducts.length; i += batchSize) {
      const batch = variantProducts.slice(i, i + batchSize);
      console.log(`Inserting variants batch ${i / batchSize + 1} (${batch.length} variants)...`);

      const values = [];
      const valuePlaceholders = [];
      let paramIndex = 1;

      for (const item of batch) {
        const { variant, masterId } = item;
        const colorName = inferColour(variant);
        const imageUrl = getImageUrl(variant);
        const productUrl = variant.aw_deep_link || variant.product_url;

        const params = [
          uuidv4(), // id
          variant.aw_product_id, // awin_id
          colorName, // color_name
          imageUrl, // image_url
          productUrl, // product_url
          masterId // product_id
        ];

        values.push(...params);
        const placeholders = [];
        for (let p = 0; p < params.length; p++) {
          placeholders.push(`$${paramIndex++}`);
        }
        valuePlaceholders.push(`(${placeholders.join(', ')})`);
      }

      const query = `
        INSERT INTO "ProductColorVariant" (
          id, awin_id, color_name, image_url, product_url, product_id
        ) VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (awin_id) DO UPDATE SET
          color_name = EXCLUDED.color_name,
          image_url = EXCLUDED.image_url,
          product_url = EXCLUDED.product_url,
          product_id = EXCLUDED.product_id;
      `;

      await client.query(query, values);
    }

    // Synchronize lookup tables
    console.log('Synchronizing lookup tables (Colour, Size, Material, Retailer)...');

    console.log('Updating Colours...');
    await client.query(`
      INSERT INTO "Colour" (id, name)
      SELECT gen_random_uuid(), colour_clean
      FROM (
        SELECT DISTINCT colour_clean 
        FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
        WHERE colour_clean IS NOT NULL AND colour_clean != ''
      ) t
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('Updating Sizes...');
    await client.query(`
      INSERT INTO "Size" (id, name)
      SELECT gen_random_uuid(), size_stock_status_clean
      FROM (
        SELECT DISTINCT size_stock_status_clean 
        FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
        WHERE size_stock_status_clean IS NOT NULL AND size_stock_status_clean != ''
      ) t
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('Updating Materials...');
    await client.query(`
      INSERT INTO "Material" (id, name)
      SELECT gen_random_uuid(), product_model_clean
      FROM (
        SELECT DISTINCT product_model_clean 
        FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
        WHERE product_model_clean IS NOT NULL AND product_model_clean != ''
      ) t
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('Updating Retailers...');
    await client.query(`
      INSERT INTO "Retailer" (id, name)
      SELECT gen_random_uuid(), merchant_name
      FROM (
        SELECT DISTINCT merchant_name 
        FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" 
        WHERE merchant_name IS NOT NULL AND merchant_name != ''
      ) t
      ON CONFLICT (name) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('\nSuccess! Ingestion completed and committed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during ingestion transaction, rolled back changes:', error);
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(console.error);
