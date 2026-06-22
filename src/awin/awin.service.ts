import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import * as csv from 'fast-csv';
import * as zlib from 'zlib';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import * as http from 'http';
import * as https from 'https';

import { ImportStatusService } from './import-status.service';
import { CategoryService } from '../category/category.service';

@Injectable()
export class AwinService {
  private readonly logger = new Logger(AwinService.name);
  private readonly awinPipelineTables = {
    raw: 'AWIN_AFFILIAT_PRODUCTS_DATA_RAW',
    dev: 'AWIN_AFFILIAT_PRODUCTS_DATA_DEV',
    prod: 'AWIN_AFFILIAT_PRODUCTS_DATA_PROD',
  };
  private readonly rawInsertBatchSize = 500;
  private readonly validSizeLabels = new Set([
    '1 Seater',
    '2 Seater',
    '3 Seater',
    '4 Seater',
    'Corner',
    'Chair',
    'Footstools',
    'Sofa Bed',
  ]);
  private readonly standardColourMap: Record<string, string> = {
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

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly statusService: ImportStatusService,
    private readonly categoryService: CategoryService,
  ) { }

  private slugify(text: string | undefined | null, suffix?: string) {
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

  async addProductFromUrl(input: string) {
    // Split by newlines, commas, or spaces to support bulk links
    const urls = input.split(/[\n\r\t]+/).map(u => u.trim()).filter(Boolean);

    if (urls.length === 0) return { message: 'No valid URLs provided' };

    const results: any[] = [];
    for (let url of urls) {
      try {
        // Handle Awin deep links by extracting the actual product URL (ued parameter)
        if (url.includes('awin1.com') && url.includes('ued=')) {
          const uedMatch = url.match(/[?&]ued=([^&]+)/);
          if (uedMatch) {
            const decodedUrl = decodeURIComponent(uedMatch[1]);
            if (decodedUrl.startsWith('http')) {
              url = decodedUrl;
            }
          }
        }

        if (url.includes('datafeed/download')) {
          const jobId = `feed-${Date.now()}`;
          this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting feed import...');

          this.processFeed(url, jobId).catch(e => {
            this.statusService.failJob(jobId, e.message);
          });

          results.push({ url, status: 'started', jobId });
        } else {
          // Check if already exists before scraping to prevent fetching
          const awinIdMatch = url.match(/[?&]aw_product_id=([^&]+)/) || url.match(/\/p\/([^/?]+)/);
          const potentialAwinId = awinIdMatch ? awinIdMatch[1] : null;

          let exists = false;
          if (potentialAwinId) {
            const existing = await this.prisma.product.findUnique({ where: { id: potentialAwinId } });
            if (existing) exists = true;
          }
          if (!exists) {
            const existingByUrl = await this.prisma.product.findFirst({ where: { productUrl: url } });
            if (existingByUrl) exists = true;
          }

          if (exists) {
            this.logger.log(`Product already exists for URL ${url}. Skipping fetch.`);
            results.push({ url, status: 'skipped', message: 'Product already added. Not fetching.' });
          } else {
            const res = await this.scrapeSingleProduct(url);
            results.push({ url, status: 'success', data: res });
          }
        }
      } catch (error) {
        this.logger.error(`Error processing URL ${url}: ${error.message}`);
        results.push({ url, status: 'error', error: error.message });
      }
    }

    if (results.length === 1) {
      if (results[0].status === 'error') {
        throw new Error(results[0].error || 'Failed to import product');
      }
      // Return jobId at top level if it exists (for feeds)
      if (results[0].jobId) {
        return { jobId: results[0].jobId, status: 'started', url: results[0].url };
      }
      if (results[0].status === 'skipped') {
        return { message: results[0].message, status: 'skipped' };
      }
      return results[0].data;
    }

    return { results };
  }


  async processFeed(url: string, jobId?: string) {
    // Ensure Awin URLs have necessary parameters to avoid 400 errors
    if (url.includes('datafeed/download') && !url.includes('/columns/') && !url.includes('columns=')) {
      if (url.includes('download.php')) {
        // Query-based URL
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}columns=any&format=csv&compression=gzip`;
      } else {
        // Path-based URL
        url = url.replace(/\/$/, ''); // Remove trailing slash if exists
        url += '/columns/any/format/csv/compression/gzip/';
      }
    }

    this.logger.log(`Fetching feed from: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
      );

      const stream = response.data as Readable;
      const isGzip = url.includes('compression/gzip') ||
        response.headers['content-encoding'] === 'gzip' ||
        url.endsWith('.gz');

      let count = 0;

      let parserStream: any = stream;
      if (isGzip) {
        parserStream = stream.pipe(zlib.createGunzip());
      }

      const parser = parserStream.pipe(csv.parse({ headers: true }));


      this.logger.log(`Starting to parse CSV stream...`);
      let rowsProcessed = 0;
      let rowsSkipped = 0;

      for await (const row of parser) {
        try {
          // Normalize keys (lowercase, no spaces/underscores) for flexible mapping
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().replace(/[\s_]/g, '');
            normalizedRow[normalizedKey] = row[key];
          });

          // Map essential fields using normalized keys
          const awProductId = normalizedRow.awproductid || normalizedRow.productid || normalizedRow.id;
          const productName = normalizedRow.productname || normalizedRow.name;

          if (!awProductId || !productName) {
            rowsSkipped++;
            if (rowsSkipped % 100 === 0 || rowsSkipped === 1) {
              this.logger.warn(`Skipping malformed row ${rowsProcessed + rowsSkipped}: Missing product ID or name. Available keys: ${Object.keys(row).join(', ')}`);
            }
            continue;
          }

          // Merge normalized keys back into row for upsertProduct to find them easily
          const rowWithMapping = { ...row, aw_product_id: awProductId, product_name: productName };

          await this.upsertProduct(rowWithMapping);
          rowsProcessed++;

          if (rowsProcessed % 100 === 0) {
            this.logger.log(`Imported ${rowsProcessed} products (Skipped ${rowsSkipped})...`);
            if (jobId) {
              this.statusService.updateJob(jobId, rowsProcessed, `Imported ${rowsProcessed} products...`);
            }
          }
        } catch (err) {
          this.logger.error(`Error saving row: ${err.message}`);
        }
      }

      this.logger.log(`Feed processing complete. Total imported: ${rowsProcessed}, Total skipped: ${rowsSkipped}`);
      if (jobId) {
        this.statusService.completeJob(jobId, `Successfully imported ${rowsProcessed} products.`);
      }
      return { message: 'Feed processed successfully', count: rowsProcessed };
    } catch (error) {
      if (error.response) {
        this.logger.error(`Failed to process feed: Status ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Failed to process feed: ${error.message}`);
      }
      if (jobId) this.statusService.failJob(jobId, error.message);
      throw error;
    }
  }

  async processCsvFile(fileBuffer: Buffer, jobId: string) {
    this.logger.log(`Processing manual CSV upload: ${jobId}`);
    try {
      const stream = Readable.from(fileBuffer);
      const parser = stream.pipe(csv.parse({ headers: true }));

      let count = 0;
      for await (const row of parser) {
        try {
          if (!row.aw_product_id || !row.product_name) continue;

          await this.upsertProduct(row);

          count++;
          if (count % 10 === 0) {
            this.statusService.updateJob(jobId, count, `Imported ${count} products...`);
          }
        } catch (err) {
          this.logger.error(`Error in CSV row: ${err.message}`);
        }
      }

      this.statusService.completeJob(jobId, `Successfully imported ${count} products.`);
      return { count };
    } catch (error) {
      if (error.response) {
        this.logger.error(`Failed to process feed: Status ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Failed to process feed: ${error.message}`);
      }
      this.statusService.failJob(jobId, error.message);
      throw error;
    }
  }

  getAwinPipelineTableNames() {
    const schema = 'public';
    return {
      raw: `${schema}."${this.awinPipelineTables.raw}"`,
      dev: `${schema}."${this.awinPipelineTables.dev}"`,
      prod: `${schema}."${this.awinPipelineTables.prod}"`,
      note: 'RAW is the direct AWIN extraction table, DEV is transformed for review, and PROD is the reviewed table Plaiss should read from.',
    };
  }

  async getAwinPipelineTableSummary() {
    await this.ensureAwinPipelineTables();

    const [raw, dev, prod] = await Promise.all([
      this.countAwinPipelineRows(this.awinPipelineTables.raw),
      this.countAwinPipelineRows(this.awinPipelineTables.dev),
      this.countAwinPipelineRows(this.awinPipelineTables.prod),
    ]);

    return {
      ...this.getAwinPipelineTableNames(),
      counts: { raw, dev, prod },
      total: raw + dev + prod,
    };
  }

  async extractAwinFeedToRaw(url: string, jobId?: string, replace = true) {
    await this.ensureAwinPipelineTables();

    let startRow = 0;
    if (!replace && jobId) {
      const [{ max }] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT MAX(row_number) as max FROM "${this.awinPipelineTables.raw}" WHERE import_job_id = $1`,
        jobId,
      );
      startRow = Number(max) || 0;
      this.logger.log(`Resuming from row ${startRow} for job ${jobId}`);
    }

    if (replace) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${this.awinPipelineTables.raw}"`);
    }

    const feedUrl = this.withAwinDownloadDefaults(url);
    this.logger.log(`Extracting AWIN feed to RAW table: ${feedUrl}`);

    const response = await firstValueFrom(
      this.httpService.get(feedUrl, {
        responseType: 'stream',
        timeout: 300000,  // 5 min timeout
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true }),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }),
    );

    const stream = response.data as Readable;
    const isGzip =
      feedUrl.includes('compression/gzip') ||
      response.headers['content-encoding'] === 'gzip' ||
      feedUrl.endsWith('.gz');
    const parserStream = isGzip ? stream.pipe(zlib.createGunzip()) : stream;
    const parser = parserStream.pipe(csv.parse({ headers: true }));

    parser.on('error', (err) => {
      this.logger.error(`Stream error at row ${count}: ${err.message}`);
    });

    let count = 0;
    let batch: Array<{ row: any; rowNumber: number }> = [];
    for await (const row of parser) {
      count++;

      if (count <= startRow) {
        continue;
      }

      batch.push({ row, rowNumber: count });

      if (batch.length >= this.rawInsertBatchSize) {
        await this.insertRawAwinRows(batch, feedUrl, jobId);
        batch = [];
      }

      if (jobId && count % 1000 === 0) {
        this.statusService.updateJob(jobId, count, `Extracted ${count} AWIN rows to RAW...`);
      }
    }

    if (batch.length > 0) {
      await this.insertRawAwinRows(batch, feedUrl, jobId);
    }

    if (jobId) {
      this.statusService.completeJob(jobId, `Extracted ${count} AWIN rows to RAW.`);
    }

    return {
      message: 'AWIN extraction complete',
      table: this.getAwinPipelineTableNames().raw,
      count,
      replaced: replace,
    };
  }

  async extractCsvFileToRaw(fileBuffer: Buffer, jobId: string, replace = true) {
    await this.ensureAwinPipelineTables();

    if (replace) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${this.awinPipelineTables.raw}"`);
    }

    const parser = Readable.from(fileBuffer).pipe(csv.parse({ headers: true }));
    let count = 0;
    let batch: Array<{ row: any; rowNumber: number }> = [];

    for await (const row of parser) {
      count++;
      batch.push({ row, rowNumber: count });

      if (batch.length >= this.rawInsertBatchSize) {
        await this.insertRawAwinRows(batch, 'manual-csv-upload', jobId);
        batch = [];
      }

      if (count % 1000 === 0) {
        this.statusService.updateJob(jobId, count, `Extracted ${count} CSV rows to RAW...`);
      }
    }

    if (batch.length > 0) {
      await this.insertRawAwinRows(batch, 'manual-csv-upload', jobId);
    }

    this.statusService.completeJob(jobId, `Extracted ${count} CSV rows to RAW.`);
    return { table: this.getAwinPipelineTableNames().raw, count, replaced: replace };
  }

  async transformRawToDev(replace = true, jobId?: string) {
    await this.ensureAwinPipelineTables();

    if (replace) {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${this.awinPipelineTables.dev}"`);
    }

    const [{ count: rawCount }] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "${this.awinPipelineTables.raw}"`,
    );
    const rawTotal = Number(rawCount) || 0;

    if (jobId) {
      this.statusService.updateJob(
        jobId,
        0,
        `Found ${rawTotal} RAW rows. Processing in streaming batches...`,
        rawTotal || 1,
      );
    }

    let transformed = 0;
    let skipped = 0;
    let rawProcessed = 0;
    let lastRowNumber = 0;
    const readBatchSize = 2000;
    const insertBatchSize = 500;

    const fields = [
      'awProductId', 'merchantProductId', 'productName', 'slug', 'description', 'price',
      'currency', 'imageUrl', 'productUrl', 'merchantName', 'categoryName', 'merchantCategory',
      'categoryId', 'brandName', 'colour', 'productModel', 'productType', 'productModelClean',
      'colourClean', 'sizeStockStatusClean', 'isRecliner', 'isSofaBed', 'baseSku',
      'colourVariantNumber', 'originalPriceClean', 'discountedPriceClean', 'saving',
      'salesDiscount', 'rawRow'
    ];

    // Stream RAW → DEV in small batches to avoid accumulating all rows in memory
    while (rawProcessed < rawTotal) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT row_number, raw_row FROM "${this.awinPipelineTables.raw}"
         WHERE row_number > $1
         ORDER BY row_number ASC
         LIMIT $2`,
        lastRowNumber,
        readBatchSize,
      );

      if (rows.length === 0) break;

      const mappedBatch: any[] = [];
      for (const item of rows) {
        const mapped = this.mapAwinRawRowToPipelineRow(item.raw_row || {});
        if (!mapped) {
          skipped++;
        } else if (
          mapped.productModelClean === 'Unknown' ||
          mapped.colourClean === 'Unknown' ||
          mapped.sizeStockStatusClean === 'Unknown'
        ) {
          skipped++;
        } else {
          mappedBatch.push(mapped);
        }
      }

      // Write this batch to DEV immediately
      for (let i = 0; i < mappedBatch.length; i += insertBatchSize) {
        const chunk = mappedBatch.slice(i, i + insertBatchSize);
        const values: any[] = [];
        const placeholders = chunk.map((row, rowIndex) => {
          const offset = rowIndex * fields.length;
          fields.forEach((field) => {
            let value = row[field];
            if (field === 'rawRow') value = JSON.stringify(value);
            else if (value === undefined) value = null;
            values.push(value);
          });
          const rowPlaceholders = fields.map((_, fieldIndex) => {
            const idx = offset + fieldIndex + 1;
            return fields[fieldIndex] === 'rawRow' ? `$${idx}::jsonb` : `$${idx}`;
          });
          return `(${rowPlaceholders.join(', ')})`;
        });

        const query = `
          INSERT INTO "${this.awinPipelineTables.dev}" (
            aw_product_id, merchant_product_id, product_name, slug, description, search_price,
            currency, image_url, product_url, merchant_name, category_name, merchant_category,
            category_id, brand_name, colour, product_model, product_type, product_model_clean,
            colour_clean, size_stock_status_clean, is_recliner, is_sofa_bed, base_sku,
            colour_variant_number, original_price_clean, discounted_price_clean, saving,
            sales_discount, raw_row
          )
          VALUES ${placeholders.join(', ')}
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
            colour_variant_number = EXCLUDED.colour_variant_number,
            original_price_clean = EXCLUDED.original_price_clean,
            discounted_price_clean = EXCLUDED.discounted_price_clean,
            saving = EXCLUDED.saving,
            sales_discount = EXCLUDED.sales_discount,
            raw_row = EXCLUDED.raw_row,
            transformed_at = NOW()
        `;

        await this.prisma.$executeRawUnsafe(query, ...values);
        transformed += chunk.length;
      }

      rawProcessed += rows.length;
      lastRowNumber = Number(rows[rows.length - 1].row_number) || lastRowNumber;

      if (jobId) {
        this.statusService.updateJob(
          jobId,
          rawProcessed,
          `Processed ${rawProcessed}/${rawTotal} RAW rows, saved ${transformed} to DEV...`,
          rawTotal || 1,
        );
      }

      await this.yieldToEventLoop();
    }

    // Set colour_variant_number via SQL window function — avoids loading all rows into memory
    if (jobId) {
      this.statusService.updateJob(jobId, rawTotal, `Computing colour variant numbers...`, rawTotal || 1);
    }
    await this.prisma.$executeRawUnsafe(`
      UPDATE "${this.awinPipelineTables.dev}" d
      SET colour_variant_number = sub.rn
      FROM (
        SELECT aw_product_id,
               ROW_NUMBER() OVER (PARTITION BY base_sku ORDER BY colour_clean) AS rn
        FROM "${this.awinPipelineTables.dev}"
        WHERE base_sku IS NOT NULL AND base_sku <> 'Unknown'
          AND colour_clean IS NOT NULL AND colour_clean <> 'Unknown'
      ) sub
      WHERE d.aw_product_id = sub.aw_product_id
    `);

    // Clear RAW table after successful transformation
    this.logger.log('Clearing RAW table after transformation...');
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${this.awinPipelineTables.raw}"`);

    const result = {
      message: 'RAW transformed to DEV',
      sourceTable: this.getAwinPipelineTableNames().raw,
      targetTable: this.getAwinPipelineTableNames().dev,
      transformed,
      skipped,
      rawRows: rawProcessed,
    };

    if (jobId) {
      this.statusService.completeJob(
        jobId,
        `DEV transform complete: ${transformed} transformed, ${skipped} skipped.`,
        result,
      );
    }

    return result;
  }

  async loadDevToProd(replace = true, syncProductTable = true, jobId?: string) {
    await this.ensureAwinPipelineTables();

    const [{ count: devRows }] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "${this.awinPipelineTables.dev}"`,
    );

    if (jobId) {
      this.statusService.updateJob(
        jobId,
        0,
        `Copying ${devRows} reviewed DEV rows to PROD...`,
        syncProductTable ? (devRows || 1) * 2 : devRows || 1,
      );
    }

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "${this.awinPipelineTables.prod}" (
        aw_product_id, merchant_product_id, product_name, slug, description, search_price,
        currency, image_url, product_url, merchant_name, category_name, merchant_category,
        category_id, brand_name, colour, product_model, product_type, product_model_clean,
        colour_clean, size_stock_status_clean, is_recliner, is_sofa_bed, base_sku,
        colour_variant_number, original_price_clean, discounted_price_clean, saving,
        sales_discount, raw_row, transformed_at, loaded_at
      )
      SELECT
        aw_product_id, merchant_product_id, product_name, slug, description, search_price,
        currency, image_url, product_url, merchant_name, category_name, merchant_category,
        category_id, brand_name, colour, product_model, product_type, product_model_clean,
        colour_clean, size_stock_status_clean, is_recliner, is_sofa_bed, base_sku,
        colour_variant_number, original_price_clean, discounted_price_clean, saving,
        sales_discount, raw_row, transformed_at, NOW()
      FROM "${this.awinPipelineTables.dev}"
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
        colour_variant_number = EXCLUDED.colour_variant_number,
        original_price_clean = EXCLUDED.original_price_clean,
        discounted_price_clean = EXCLUDED.discounted_price_clean,
        saving = EXCLUDED.saving,
        sales_discount = EXCLUDED.sales_discount,
        raw_row = EXCLUDED.raw_row,
        transformed_at = EXCLUDED.transformed_at,

        loaded_at = NOW()
    `);

    const [{ count }] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "${this.awinPipelineTables.prod}"`,
    );

    if (jobId) {
      this.statusService.updateJob(
        jobId,
        devRows,
        syncProductTable
          ? `PROD has ${count} rows. Syncing Plaiss products...`
          : `PROD has ${count} rows.`,
      );
    }

    if (syncProductTable) {
      this.logger.log('Running deduplication on PROD data...');
      try {
        await this.deduplicateProducts();
      } catch (err) {
        this.logger.error(`Deduplication failed during promotion: ${err.message}`);
      }
    }

    const syncedProducts = 0; // Disabled redundant sync to Product table (Single Prod Table design)

    // Clear DEV table after successful promotion
    this.logger.log('Clearing DEV table after promotion...');
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${this.awinPipelineTables.dev}"`);

    const result = {
      message: 'DEV loaded to PROD',
      sourceTable: this.getAwinPipelineTableNames().dev,
      targetTable: this.getAwinPipelineTableNames().prod,
      devRows,
      prodRows: count,
      syncedProducts,
      replaced: replace,
    };

    if (jobId) {
      this.statusService.completeJob(
        jobId,
        `PROD promotion complete: ${count} PROD rows, ${syncedProducts} products synced.`,
        result,
      );
    }

    return result;
  }

  private withAwinDownloadDefaults(url: string) {
    if (url.includes('datafeed/download') && !url.includes('/columns/') && !url.includes('columns=')) {
      if (url.includes('download.php')) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}columns=any&format=csv&compression=gzip`;
      }

      return `${url.replace(/\/$/, '')}/columns/any/format/csv/compression/gzip/`;
    }

    return url;
  }

  private async ensureAwinPipelineTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${this.awinPipelineTables.raw}" (
        id TEXT PRIMARY KEY,
        row_number INTEGER NOT NULL,
        source_url TEXT,
        import_job_id TEXT,
        raw_row JSONB NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "idx_awin_raw_row_number"
       ON "${this.awinPipelineTables.raw}" (row_number)`,
    );

    await this.prisma.$executeRawUnsafe(
      this.createPipelineProductTableSql(this.awinPipelineTables.dev, false),
    );
    await this.prisma.$executeRawUnsafe(
      this.createPipelineProductTableSql(this.awinPipelineTables.prod, true),
    );
    await this.ensurePipelineProductColumns(this.awinPipelineTables.dev, false);
    await this.ensurePipelineProductColumns(this.awinPipelineTables.prod, true);
  }

  private async countAwinPipelineRows(tableName: string) {
    const [{ count }] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "${tableName}"`,
    );

    return Number(count) || 0;
  }

  private async yieldToEventLoop() {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  private async ensurePipelineProductColumns(tableName: string, includeLoadedAt: boolean) {
    const columns = [
      ['product_model_clean', 'TEXT'],
      ['colour_clean', 'TEXT'],
      ['size_stock_status_clean', 'TEXT'],
      ['is_recliner', 'TEXT'],
      ['is_sofa_bed', 'TEXT'],
      ['base_sku', 'TEXT'],
      ['colour_variant_number', 'INTEGER'],
      ['original_price_clean', 'DOUBLE PRECISION'],
      ['discounted_price_clean', 'DOUBLE PRECISION'],
      ['saving', 'DOUBLE PRECISION'],
      ['sales_discount', 'TEXT'],
      ...(includeLoadedAt ? [['loaded_at', 'TIMESTAMPTZ NOT NULL DEFAULT NOW()']] : []),
    ];

    for (const [column, type] of columns) {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS ${column} ${type}`,
      );
    }
  }

  private createPipelineProductTableSql(tableName: string, includeLoadedAt: boolean) {
    return `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        aw_product_id TEXT PRIMARY KEY,
        merchant_product_id TEXT,
        product_name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        search_price DOUBLE PRECISION,
        currency TEXT,
        image_url TEXT,
        product_url TEXT,
        merchant_name TEXT,
        category_name TEXT,
        merchant_category TEXT,
        category_id TEXT,
        brand_name TEXT,
        colour TEXT,
        product_model TEXT,
        product_type TEXT,
        product_model_clean TEXT,
        colour_clean TEXT,
        size_stock_status_clean TEXT,
        is_recliner TEXT,
        is_sofa_bed TEXT,
        base_sku TEXT,
        colour_variant_number INTEGER,
        original_price_clean DOUBLE PRECISION,
        discounted_price_clean DOUBLE PRECISION,
        saving DOUBLE PRECISION,
        sales_discount TEXT,
        raw_row JSONB NOT NULL,
        transformed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        ${includeLoadedAt ? ', loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()' : ''}
      )
    `;
  }

  private async insertRawAwinRow(row: any, rowNumber: number, sourceUrl: string, jobId?: string) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${this.awinPipelineTables.raw}" (id, row_number, source_url, import_job_id, raw_row)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      randomUUID(),
      rowNumber,
      sourceUrl,
      jobId || null,
      JSON.stringify(row),
    );
  }

  private async insertRawAwinRows(
    rows: Array<{ row: any; rowNumber: number }>,
    sourceUrl: string,
    jobId?: string,
  ) {
    if (rows.length === 0) return;

    const values: any[] = [];
    const placeholders = rows.map(({ row, rowNumber }, index) => {
      const offset = index * 5;
      values.push(randomUUID(), rowNumber, sourceUrl, jobId || null, JSON.stringify(row));
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb)`;
    });

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${this.awinPipelineTables.raw}" (id, row_number, source_url, import_job_id, raw_row)
       VALUES ${placeholders.join(', ')}`,
      ...values,
    );
  }

  private mapAwinRawRowToPipelineRow(row: any) {
    const getVal = this.getAwinValueGetter(row);
    const awProductId = getVal(['aw_product_id', 'awproductid', 'productid', 'id']);
    const productName = getVal(['product_name', 'productname', 'name', 'title']);
    const price = this.toNullableFloat(getVal(['search_price', 'price', 'store_price']));
    const imageUrl = this.toHttps(
      getVal(['merchant_image_url', 'aw_image_url', 'large_image', 'image_url', 'alternate_image', 'image', 'aw_thumb_url']),
    );
    const rawProductType = getVal(['product_type']);
    const rawMerchantCategory = getVal(['merchant_category', 'category_name', 'categoryname', 'category']);
    let categoryName = this.extractLeafCategory(rawProductType || rawMerchantCategory || getVal(['merchant_product_category_path']));
    const sofaText = this.combineAwinFields(getVal, [
      'product_name',
      'name',
      'merchant_category',
      'merchantCategory',
      'category_name',
      'category',
      'product_type',
      'productType',
      'merchant_product_category_path',
    ]);

    const name = (productName || '').toLowerCase();
    const desc = (getVal(['description', 'product_description']) || '').toLowerCase();
    const type = (rawProductType || '').toLowerCase();
    const path = (getVal(['merchant_product_category_path']) || '').toLowerCase();

    const hasLED = /\bLED\b/i.test(name) || /\bLED\b/i.test(desc);
    const hasLightingType = /\b(wall|floor|table|lamp)s?\b/i.test(type) || /\b(wall|floor|table|lamp)s?\b/i.test(path);
    const isLighting = hasLED || hasLightingType;
    const isOtherDesired = /sofa|couch|settee|chair|rug|decor|plant|kitchen/i.test(sofaText);
    const isArtificial = /artificial|plastic|fake|faux|synthetic/i.test(name);

    if (
      isArtificial ||
      (!isOtherDesired && !isLighting) ||
      !awProductId ||
      !productName ||
      !price ||
      !imageUrl ||
      !categoryName ||
      categoryName === 'collection'
    ) {
      return null;
    }

    // Update category name for LED lighting combinations
    if (hasLED && hasLightingType) {
      if (/\bwall\b/i.test(sofaText)) categoryName = 'Wall LED';
      else if (/\bfloor\b/i.test(sofaText)) categoryName = 'Floor LED';
      else if (/\btable\b/i.test(sofaText)) categoryName = 'Table LED';
      else if (/\blamp\b/i.test(sofaText)) categoryName = 'Lamp LED';
    }





    const productModelClean = this.inferAwinProductModel(row, getVal, categoryName);
    const colourClean = this.inferAwinColour(row, getVal, categoryName);
    const sizeStockStatusClean = this.inferAwinSizeStockStatus(row, getVal, categoryName);
    const originalPriceClean = this.parseAwinPrice(
      this.getFirstAwinValue(row, ['rrp_price', 'rrp', 'was_price', 'wasPrice', 'base_price', 'basePrice']),
    );
    const discountedPriceClean = this.parseAwinPrice(
      this.getFirstAwinValue(row, ['display_price', 'displayPrice', 'search_price', 'store_price', 'price']),
    );
    const saving =
      originalPriceClean !== null && discountedPriceClean !== null && originalPriceClean - discountedPriceClean >= 5
        ? originalPriceClean - discountedPriceClean
        : 0;

    return {
      awProductId,
      merchantProductId: getVal(['merchant_product_id']),
      productName,
      slug: this.slugify(productName, awProductId),
      description: getVal(['description', 'product_description']),
      price,
      currency: getVal(['currency']),
      imageUrl,
      productUrl: getVal(['aw_deep_link', 'product_url', 'url']),
      merchantName: getVal(['merchant_name', 'merchant', 'store_name']),
      categoryName,
      merchantCategory: rawMerchantCategory,
      categoryId: getVal(['category_id']),
      brandName: getVal(['brand_name', 'brand']),
      colour: getVal(['colour', 'color']),
      productModel: getVal(['product_model']),
      productType: rawProductType,
      productModelClean,
      colourClean,
      sizeStockStatusClean,
      isRecliner: this.inferAwinIsRecliner(row, getVal),
      isSofaBed: this.inferAwinIsSofaBed(row, getVal),
      baseSku: this.extractBaseSkuFromAwinRow(row),
      colourVariantNumber: null,
      originalPriceClean,
      discountedPriceClean,
      saving,
      salesDiscount: saving >= 5 ? 'Yes' : 'No',
      rawRow: row,
    };
  }

  private async upsertPipelineProductRow(tableName: string, row: any) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${tableName}" (
        aw_product_id, merchant_product_id, product_name, slug, description, search_price,
        currency, image_url, product_url, merchant_name, category_name, merchant_category,
        category_id, brand_name, colour, product_model, product_type, product_model_clean,
        colour_clean, size_stock_status_clean, is_recliner, is_sofa_bed, base_sku,
        colour_variant_number, original_price_clean, discounted_price_clean, saving,
        sales_discount, raw_row
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::jsonb)
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
        colour_variant_number = EXCLUDED.colour_variant_number,
        original_price_clean = EXCLUDED.original_price_clean,
        discounted_price_clean = EXCLUDED.discounted_price_clean,
        saving = EXCLUDED.saving,
        sales_discount = EXCLUDED.sales_discount,
        raw_row = EXCLUDED.raw_row,
        transformed_at = NOW()`,

      row.awProductId,
      row.merchantProductId || null,
      row.productName,
      row.slug,
      row.description || null,
      row.price,
      row.currency || null,
      row.imageUrl,
      row.productUrl || null,
      row.merchantName || null,
      row.categoryName,
      row.merchantCategory || null,
      row.categoryId || null,
      row.brandName || null,
      row.colour || null,
      row.productModel || null,
      row.productType || null,
      row.productModelClean || null,
      row.colourClean || null,
      row.sizeStockStatusClean || null,
      row.isRecliner || null,
      row.isSofaBed || null,
      row.baseSku || null,
      row.colourVariantNumber || null,
      row.originalPriceClean,
      row.discountedPriceClean,
      row.saving,
      row.salesDiscount || null,
      JSON.stringify(row.rawRow),
    );
  }

  private async syncProductModelFromAwinProd(jobId?: string, progressOffset = 0, progressTotal?: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${this.awinPipelineTables.prod}" ORDER BY loaded_at DESC`,
    );

    let synced = 0;

    // Load caches
    const categories = await (this.prisma as any).category.findMany();
    const categoryCache = new Map<string, { id: string, name: string }>();
    categories.forEach(c => {
      categoryCache.set(c.name.toLowerCase().trim(), { id: c.id, name: c.name });
    });




    const insertBatchSize = 1000;
    const fields = [
      'id', 'name', 'slug', 'description', 'price', 'currency', 'imageUrl', 'productUrl',
      'merchant', 'category', 'merchantProductId',
      'merchantCategory', 'categoryId', 'brandName', 'colour', 'productModel',
      'productType', 'sizeStockStatus', 'saving', 'basePrice', 'displayPrice', 'awinId'
    ];

    for (let i = 0; i < rows.length; i += insertBatchSize) {
      const chunk = rows.slice(i, i + insertBatchSize);

      const productsToUpsert: any[] = [];
      for (const row of chunk) {
        let catRec: { id: string; name: string; } | null | undefined = categoryCache.get(row.category_name.toLowerCase().trim());
        if (!catRec && row.category_name) {
          catRec = await this.getOrCreateCategoryRecord(row.category_name);
          if (catRec) {
            categoryCache.set(row.category_name.toLowerCase().trim(), catRec);
          }
        }

        productsToUpsert.push({
          id: randomUUID(),
          name: row.product_name,
          slug: row.slug,
          description: row.description,
          price: row.search_price,
          currency: row.currency,
          imageUrl: row.image_url,
          productUrl: row.product_url,
          merchant: row.merchant_name,
          category: catRec?.name || row.category_name,
          merchantProductId: row.merchant_product_id,
          merchantCategory: row.merchant_category,
          categoryId: row.category_id,
          brandName: row.brand_name,
          colour: row.colour_clean || row.colour,
          productModel: row.product_model_clean || row.product_model,
          productType: row.product_type,
          sizeStockStatus: row.size_stock_status_clean,
          saving: row.saving,
          basePrice: row.original_price_clean,
          displayPrice: row.discounted_price_clean?.toString(),
          awinId: row.aw_product_id,
        });
      }

      // Bulk upsert products
      const values: any[] = [];
      const placeholders = productsToUpsert.map((row, rowIndex) => {
        const offset = rowIndex * fields.length;
        fields.forEach((field) => {
          let value = row[field];
          if (value === undefined) value = null;
          values.push(value);
        });

        const rowPlaceholders = fields.map((_, fieldIndex) => `$${offset + fieldIndex + 1}`);
        return `(${rowPlaceholders.join(', ')}, NOW())`;
      });

      const query = `
        INSERT INTO "Product" (
          id, name, slug, description, price, currency, "imageUrl", "productUrl",
          merchant, category, "merchantProductId",
          "merchantCategory", "categoryId", "brandName", colour, "productModel",
          "productType", "sizeStockStatus", saving, "basePrice", "displayPrice", "awinId", "updatedAt"
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT ("awinId") DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          "imageUrl" = EXCLUDED."imageUrl",
          "productUrl" = EXCLUDED."productUrl",
          merchant = EXCLUDED.merchant,
          category = EXCLUDED.category,
          "merchantProductId" = EXCLUDED."merchantProductId",
          "merchantCategory" = EXCLUDED."merchantCategory",
          "categoryId" = EXCLUDED."categoryId",
          "brandName" = EXCLUDED."brandName",
          colour = EXCLUDED.colour,
          "productModel" = EXCLUDED."productModel",
          "productType" = EXCLUDED."productType",
          "sizeStockStatus" = EXCLUDED."sizeStockStatus",
          saving = EXCLUDED.saving,
          "basePrice" = EXCLUDED."basePrice",
          "displayPrice" = EXCLUDED."displayPrice",
          "updatedAt" = NOW()
        RETURNING id, "awinId"
      `;

      const result = await this.prisma.$queryRawUnsafe<Array<{ id: string, awinId: string }>>(query, ...values);



      synced += chunk.length;

      if (jobId) {
        this.statusService.updateJob(
          jobId,
          progressOffset + synced,
          `Synced ${synced} Plaiss products from PROD...`,
          progressTotal || progressOffset + rows.length || 1,
        );
      }
    }

    return synced;
  }

  private cleanAwinText(value: any) {
    if (value === undefined || value === null) return '';

    let text = String(value).toLowerCase();
    try {
      text = decodeURIComponent(text);
    } catch {
      // Keep the original text if the retailer sends a partially encoded URL fragment.
    }

    return text
      .replace(/[-_/>]/g, ' ')
      .replace(/[^a-z0-9\s+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private combineAwinFields(getVal: Function, fields: string[]) {
    return fields
      .map((field) => this.cleanAwinText(getVal([field])))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private inferAwinProductModel(row: any, getVal: Function, categoryName: string) {
    const cat = categoryName.toLowerCase();
    if (cat.includes('light')) {
      return null;
    }
    if (cat.includes('decor') || cat.includes('plant') || cat.includes('rug') || cat.includes('kitchen')) {
      return 'Standard';
    }
    const fields = [
      'merchant_deep_link',
      'merchantDeepLink',
      'merchant_product_id',
      'product_name',
      'name',
      'description',
      'product_type',
      'productType',
      'merchant_category',
      'merchantCategory',
      'merchant_product_category_path',
      'merchant_product_second_category',
      'merchantProductSecondCategory',
      'merchant_product_third_category',
      'merchantProductThirdCategory',
      'brand_name',
      'product_model',
      'productModel',
      'Fashion:material',
    ];

    for (const field of fields) {
      const text = this.combineAwinFields(getVal, [field]);
      if (!text) continue;

      const hasFabric = /\bfabric\b|\bvelvet\b|\blinen\b|\blinen\s+fabric\b|\bplush\s+velvet\b|\bupholstered\b/.test(text);
      const hasLeather = /\bfaux\s+leather\b|\bleather\b/.test(text);

      if (hasFabric && !hasLeather) return 'Fabric';
      if (hasLeather && !hasFabric) return 'Leather';
      if (hasFabric && hasLeather) return 'Review';
    }

    return 'Unknown';
  }

  private inferAwinColour(row: any, getVal: Function, categoryName: string) {
    const fields = [
      'merchant_deep_link',
      'merchantDeepLink',
      'merchant_product_id',
      'product_name',
      'name',
      'description',
      'product_type',
      'productType',
      'merchant_category',
      'merchantCategory',
      'merchant_product_category_path',
      'merchant_product_second_category',
      'merchantProductSecondCategory',
      'merchant_product_third_category',
      'merchantProductThirdCategory',
      'colour',
      'color',
      'Fashion:swatch',
      'custom_1',
      'custom_2',
      'custom_3',
    ];

    for (const field of fields) {
      const detected = this.detectStandardColour(this.combineAwinFields(getVal, [field]));
      if (detected !== 'Unknown') return detected;
    }

    const cat = categoryName.toLowerCase();
    if (cat.includes('light') || cat.includes('decor') || cat.includes('plant') || cat.includes('rug') || cat.includes('kitchen')) {
      return 'N/A';
    }

    return 'Unknown';
  }

  private detectStandardColour(text: string) {
    if (!text) return 'Unknown';

    const colours = Object.keys(this.standardColourMap).sort((a, b) => b.length - a.length);
    for (const rawColour of colours) {
      const escaped = rawColour.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(text)) {
        return this.standardColourMap[rawColour];
      }
    }

    return 'Unknown';
  }

  private inferAwinSizeStockStatus(row: any, getVal: Function, categoryName: string) {
    const cat = categoryName.toLowerCase();
    if (cat.includes('light')) {
      return null;
    }
    if (cat.includes('decor') || cat.includes('plant') || cat.includes('rug') || cat.includes('kitchen')) {
      return 'Standard';
    }
    const existing = getVal(['size_stock_status', 'sizeStockStatus']);
    if (existing) {
      const existingClean = String(existing)
        .trim()
        .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
      if (this.validSizeLabels.has(existingClean)) return existingClean;
    }

    const text = this.combineAwinFields(getVal, [
      'size_stock_status',
      'sizeStockStatus',
      'product_name',
      'name',
      'description',
      'product_type',
      'productType',
      'merchant_category',
      'merchantCategory',
      'merchant_product_category_path',
      'merchant_product_second_category',
      'merchantProductSecondCategory',
      'merchant_product_third_category',
      'merchantProductThirdCategory',
      'merchant_deep_link',
      'merchantDeepLink',
      'Fashion:size',
    ]);

    const rules: Array<[RegExp, string]> = [
      [/\bsofa\s+bed\b|\bsofabed\b/, 'Sofa Bed'],
      [/\bfootstool\b|\bfootstools\b|\botto(?:man)?\b/, 'Footstools'],
      [/\bcorner\b|\bl\s*shape\b|\blhf\b|\brhf\b|\bleft hand\b|\bright hand\b|\bchaise\b/, 'Corner'],
      [/\barmchair\b|\bchair\b|\bsnuggle chair\b|\bswivel chair\b|\brecliner chair\b/, 'Chair'],
      [/\b1\s*seater\b|\bone\s+seater\b/, '1 Seater'],
      [/\b2\s*seater\b|\btwo\s+seater\b/, '2 Seater'],
      [/\b3\s*seater\b|\bthree\s+seater\b/, '3 Seater'],
      [/\b4\s*seater\b|\bfour\s+seater\b/, '4 Seater'],
    ];

    for (const [pattern, label] of rules) {
      if (pattern.test(text)) return label;
    }

    return 'Unknown';
  }

  private inferAwinIsRecliner(row: any, getVal: Function) {
    const text = this.combineAwinFields(getVal, [
      'product_name',
      'name',
      'description',
      'product_short_description',
      'specifications',
      'keywords',
      'product_type',
      'productType',
      'merchant_category',
      'merchantCategory',
      'category_name',
      'category',
      'merchant_product_category_path',
      'merchant_deep_link',
      'merchantDeepLink',
    ]);

    return /\brecliner\b|\breclining\b|\bpower\s+recliner\b|\bmanual\s+recliner\b/.test(text) ? 'Yes' : 'No';
  }

  private inferAwinIsSofaBed(row: any, getVal: Function) {
    const text = this.combineAwinFields(getVal, [
      'product_name',
      'name',
      'description',
      'product_short_description',
      'specifications',
      'keywords',
      'product_type',
      'productType',
      'merchant_category',
      'merchantCategory',
      'category_name',
      'category',
      'merchant_product_category_path',
      'merchant_deep_link',
      'merchantDeepLink',
    ]);

    return /\bsofa\s+bed\b|\bsofabed\b|\bsofa\s+with\s+bed\b/.test(text) ? 'Yes' : 'No';
  }

  private extractBaseSkuFromAwinRow(row: any) {
    const value = this.getFirstAwinValue(row, [
      'merchant_product_id',
      'merchantProductId',
      'parent_product_id',
      'merchant_deep_link',
      'merchantDeepLink',
      'aw_deep_link',
      'product_url',
      'url',
    ]);

    if (!value) return 'Unknown';

    const text = String(value);
    const olMatch = text.match(/\b(OL\d+)/i);
    if (olMatch) return olMatch[1].toUpperCase();

    const pathProductMatch = text.match(/-p-(\d+)/i);
    if (pathProductMatch) return pathProductMatch[1];

    const hashMatch = text.match(/#(\d+)/);
    if (hashMatch) return hashMatch[1];

    const trailingNumberMatch = text.match(/(\d+)(?:\.html)?(?:\?|$)/i);
    if (trailingNumberMatch) return trailingNumberMatch[1];

    return 'Unknown';
  }

  private addVariantNumbers(rows: any[]) {
    const variantsBySku = new Map<string, Set<string>>();

    for (const row of rows) {
      if (row.baseSku === 'Unknown' || row.colourClean === 'Unknown') continue;
      const colours = variantsBySku.get(row.baseSku) || new Set<string>();
      colours.add(row.colourClean);
      variantsBySku.set(row.baseSku, colours);
    }

    const variantNumbers = new Map<string, number>();
    for (const [baseSku, colours] of variantsBySku.entries()) {
      Array.from(colours)
        .sort()
        .forEach((colour, index) => {
          variantNumbers.set(`${baseSku}::${colour}`, index + 1);
        });
    }

    for (const row of rows) {
      row.colourVariantNumber = variantNumbers.get(`${row.baseSku}::${row.colourClean}`) || null;
    }
  }

  private getFirstAwinValue(row: any, fields: string[]) {
    const getVal = this.getAwinValueGetter(row);
    for (const field of fields) {
      const value = getVal([field]);
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }

    return undefined;
  }

  private parseAwinPrice(value: any) {
    if (value === undefined || value === null) return null;
    const parsed = parseFloat(String(value).replace(/,/g, '').replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getAwinValueGetter(row: any) {
    const normalizedRow: any = {};
    Object.keys(row || {}).forEach((key) => {
      normalizedRow[key.toLowerCase().replace(/[\s_]/g, '')] = row[key];
    });

    return (keys: string[]) => {
      for (const key of keys) {
        const normalized = key.toLowerCase().replace(/[\s_]/g, '');
        if (normalizedRow[normalized] !== undefined && normalizedRow[normalized] !== '') {
          return normalizedRow[normalized];
        }
      }
      return undefined;
    };
  }

  private toNullableFloat(value: any) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toHttps(value: any) {
    return value ? String(value).replace('http://', 'https://') : '';
  }

  private async upsertProduct(row: any) {
    // Normalize keys for internal lookup
    const normalizedRow: any = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = key.toLowerCase().replace(/[\s_]/g, '');
      normalizedRow[normalizedKey] = row[key];
    });

    const getVal = (keys: string[]) => {
      for (const k of keys) {
        const normalized = k.toLowerCase().replace(/[\s_]/g, '');
        if (normalizedRow[normalized] !== undefined) return normalizedRow[normalized];
      }
      return undefined;
    };

    const awProductId = getVal(['aw_product_id', 'awproductid', 'productid', 'id']);
    const productName = getVal(['product_name', 'productname', 'name', 'title']);
    const rawProductType = getVal(['product_type']);
    const rawMerchantCategory = getVal(['merchant_category', 'category_name', 'categoryname', 'category']);
    const categoryPath = rawProductType || rawMerchantCategory || getVal(['merchant_product_category_path']);
    let finalCategory = this.extractLeafCategory(categoryPath);

    // 1. Category Merging Logic: 
    if (finalCategory && finalCategory !== 'collection') {
      const catRec = await this.getOrCreateCategoryRecord(finalCategory);
      if (catRec) {
        finalCategory = catRec.name;
      }
    }

    // Ensure product has basic complete attributes
    const finalPrice = parseFloat(getVal(['search_price', 'price'])) || 0;

    // Find first image that isn't a broken placeholder
    const imageKeys = ['merchant_image_url', 'large_image', 'aw_image_url', 'image_url', 'alternate_image', 'image', 'aw_thumb_url'];
    let finalImageUrl = '';

    for (const key of imageKeys) {
      const val = getVal([key]);
      if (val && !val.includes('noimage.gif') && !val.includes('no_image')) {
        finalImageUrl = val.replace('http://', 'https://');
        break;
      }
    }

    // Fallback if all have noimage or are empty
    if (!finalImageUrl) {
      finalImageUrl = (getVal(imageKeys) || '').replace('http://', 'https://');
    }

    if (!productName || productName === 'Unknown Product' || finalPrice === 0 || !finalImageUrl || !finalCategory || finalCategory === 'collection') {
      throw new Error(`Product has incomplete attributes. Name: ${productName}, Price: ${finalPrice}, Category: ${finalCategory}. Must not import.`);
    }

    const productData: any = {
      name: productName,
      slug: this.slugify(productName, awProductId),
      description: getVal(['description', 'product_description']),
      price: parseFloat(getVal(['search_price', 'price'])) || 0,
      currency: getVal(['currency']),
      imageUrl: finalImageUrl,
      productUrl: getVal(['aw_deep_link', 'product_url', 'url']),
      merchant: getVal(['merchant_name', 'merchant', 'store_name']),
      category: finalCategory,
      // New Awin Fields
      merchantProductId: getVal(['merchant_product_id']),
      merchantCategory: rawMerchantCategory,
      merchantId: getVal(['merchant_id']),
      categoryId: getVal(['category_id']),
      storePrice: parseFloat(getVal(['store_price'])) || null,
      deliveryCost: parseFloat(getVal(['delivery_cost'])) || null,
      merchantDeepLink: getVal(['merchant_deep_link']),
      language: getVal(['language']),
      lastUpdated: getVal(['last_updated']),
      displayPrice: getVal(['display_price']),
      dataFeedId: getVal(['data_feed_id']),
      brandName: getVal(['brand_name', 'brand']),
      brandId: getVal(['brand_id']),
      colour: getVal(['colour', 'color']),
      productShortDescription: getVal(['product_short_description']),
      specifications: getVal(['specifications']),
      condition: getVal(['condition']),
      productModel: getVal(['product_model']),
      modelNumber: getVal(['model_number']),
      dimensions: getVal(['dimensions']),
      keywords: getVal(['keywords']),
      promotionalText: getVal(['promotional_text']),
      productType: rawProductType,
      commissionGroup: getVal(['commission_group']),
      merchantProductCategoryPath: getVal(['merchant_product_category_path']),
      merchantProductSecondCategory: getVal(['merchant_product_second_category']),
      merchantProductThirdCategory: getVal(['merchant_product_third_category']),
      rrpPrice: parseFloat(getVal(['rrp_price'])) || null,
      saving: parseFloat(getVal(['saving'])) || null,
      savingsPercent: getVal(['savings_percent']),
      basePrice: parseFloat(getVal(['base_price'])) || null,
      basePriceAmount: parseFloat(getVal(['base_price_amount'])) || null,
      basePriceText: getVal(['base_price_text']),
      productPriceOld: parseFloat(getVal(['product_price_old'])) || null,
      deliveryRestrictions: getVal(['delivery_restrictions']),
      deliveryWeight: getVal(['delivery_weight']),
      warranty: getVal(['warranty']),
      termsOfContract: getVal(['terms_of_contract']),
      deliveryTime: getVal(['delivery_time']),
      inStock: getVal(['in_stock']),
      stockQuantity: parseInt(getVal(['stock_quantity'])) || null,
      validFrom: getVal(['valid_from']),
      validTo: getVal(['valid_to']),
      isForSale: getVal(['is_for_sale']),
      webOffer: getVal(['web_offer']),
      preOrder: getVal(['pre_order']),
      stockStatus: getVal(['stock_status']),
      sizeStockStatus: getVal(['size_stock_status']),
      sizeStockAmount: getVal(['size_stock_amount']),
      merchantThumbUrl: getVal(['merchant_thumb_url']),
      largeImage: getVal(['large_image']),
      alternateImage: getVal(['alternate_image']),
      awThumbUrl: getVal(['aw_thumb_url']),
      alternateImageTwo: getVal(['alternate_image_two']),
      alternateImageThree: getVal(['alternate_image_three']),
      alternateImageFour: getVal(['alternate_image_four']),
      reviews: getVal(['reviews']),
      averageRating: getVal(['average_rating']),
      rating: getVal(['rating']),
      numberAvailable: getVal(['number_available']),
      custom1: getVal(['custom1', 'custom_1']),
      custom2: getVal(['custom2', 'custom_2']),
      custom3: getVal(['custom3', 'custom_3']),
      custom4: getVal(['custom4', 'custom_4']),
      custom5: getVal(['custom5', 'custom_5']),
      custom6: getVal(['custom6', 'custom_6']),
      custom7: getVal(['custom7', 'custom_7']),
      custom8: getVal(['custom8', 'custom_8']),
      custom9: getVal(['custom9', 'custom_9']),
      ean: getVal(['ean']),
      isbn: getVal(['isbn']),
      upc: getVal(['upc']),
      mpn: getVal(['mpn']),
      parentProductId: getVal(['parent_product_id', 'parentproductid']),
      productGTIN: getVal(['product_gtin', 'productgtin']),
      basketLink: getVal(['basket_link', 'basketlink']),
    };

    // Check if this is a color variant of an existing product
    const parentProductId = getVal(['parent_product_id', 'parentproductid']);
    let mainProductIdToUse = null;

    if (parentProductId) {
      const existingParent = await (this.prisma as any).product.findFirst({
        where: { OR: [{ awinId: parentProductId }, { parentProductId: parentProductId }] }
      });
      if (existingParent && existingParent.awinId !== awProductId) {
        mainProductIdToUse = existingParent.id;
      }
    }

    if (!mainProductIdToUse && productData.productModel) {
      const existingByModel = await (this.prisma as any).product.findFirst({
        where: { productModel: productData.productModel, brandName: productData.brandName }
      });
      if (existingByModel && existingByModel.awinId !== awProductId) {
        mainProductIdToUse = existingByModel.id;
      }
    }

    const colour = getVal(['colour', 'color']);

    if (!mainProductIdToUse && colour) {
      // Try matching by base name (name without color)
      let baseName = productName;
      const regex = new RegExp(`\\b${colour}\\b`, 'ig');
      baseName = baseName.replace(regex, '').replace(/[-\s_]+$/, '').trim();

      if (baseName.length > 5) { // Ensure baseName is significant
        const existingByBaseName = await (this.prisma as any).product.findFirst({
          where: { name: { startsWith: baseName }, merchant: productData.merchant }
        });
        if (existingByBaseName && existingByBaseName.awinId !== awProductId) {
          mainProductIdToUse = existingByBaseName.id;
        }
      }
    }



    // Mapping Awin CSV columns to our schema
    const product = await (this.prisma as any).product.upsert({
      where: { id: awProductId },
      update: productData,
      create: {
        ...productData,
        awinId: awProductId,
      },
    });



    return product;
  }

  async scrapeSingleProduct(url: string) {
    this.logger.log(`Scraping single product from URL: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
          timeout: 10000,
        }),
      );

      const html = response.data;
      const $ = cheerio.load(html);

      const name = $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text() || 'Unknown Product';

      const description = $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') || '';

      const imageUrl = $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') || '';

      const productUrl = url;

      // Extract Price
      let price = 0;
      const priceMeta = $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[name="twitter:data1"]').attr('content') ||
        $('[itemprop="price"]').attr('content');

      if (priceMeta && typeof priceMeta === 'string') {
        price = parseFloat(priceMeta.replace(/[^0-9.]/g, '')) || 0;
      }

      // Extract Currency
      const currency = $('meta[property="product:price:currency"]').attr('content') ||
        $('meta[itemprop="priceCurrency"]').attr('content') || 'GBP';

      // Extract Category
      const category = $('meta[property="product:category"]').attr('content') ||
        $('meta[property="product:section"]').attr('content') ||
        $('meta[name="category"]').attr('content') ||
        'collection';

      const safeCategory = (category || 'collection').toLowerCase().trim();

      // Enforce complete attributes before proceeding
      if (!name || name === 'Unknown Product' || price === 0 || !imageUrl || safeCategory === 'collection') {
        this.logger.warn(`Incomplete attributes for ${url}. Name: ${name}, Price: ${price}, Image: ${imageUrl}, Category: ${safeCategory}`);
        throw new Error('Product has incomplete attributes (missing name, price, image, or category). Must not import from link.');
      }

      // Try to get a unique Awin ID or similar from URL to prevent duplicates
      const awinIdMatch = url.match(/[?&]aw_product_id=([^&]+)/) || url.match(/\/p\/([^/?]+)/);
      const awinId = awinIdMatch ? awinIdMatch[1] : `manual-${Date.now()}`;

      // Auto-sync category
      let finalCategoryName = safeCategory;
      if (safeCategory && safeCategory !== 'collection') {
        const catRec = await this.getOrCreateCategoryRecord(safeCategory);
        if (catRec) {
          finalCategoryName = catRec.name;
        }
      }

      const product = await (this.prisma as any).product.upsert({
        where: { id: awinId },
        update: {
          name,
          slug: this.slugify(name, awinId),
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          category: finalCategoryName,
          merchant: this.extractMerchant(url),
          // New fields support for single product scraping
          merchantProductId: awinId, // Use awinId if specific merchant ID is not scraped
        },
        create: {
          awinId,
          name,
          slug: this.slugify(name, awinId),
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          category: finalCategoryName,
          merchant: this.extractMerchant(url),
          merchantProductId: awinId,
        },
      });



      this.logger.log(`Successfully processed product: ${product.name} (ID: ${product.id})`);
      return product;

    } catch (error) {
      this.logger.error(`Failed to add product: ${error.message}`);
      throw error;
    }
  }

  private extractMerchant(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname;
    } catch {
      return 'Awin Merchant';
    }
  }

  private extractLeafCategory(path: string | undefined | null): string {
    if (!path) return 'collection';
    // Split by > or | or &gt;
    const parts = path.split(/\s*[>|]\s*|\s*&gt;\s*/);
    return parts[parts.length - 1].trim() || 'collection';
  }

  private async getOrCreateCategoryRecord(categoryName: string): Promise<{ id: string, name: string } | null> {
    const cleanName = categoryName.toLowerCase().trim();
    if (!cleanName || cleanName === 'collection') return null;

    let catRecord = await (this.prisma as any).category.findFirst({
      where: { name: { equals: cleanName, mode: 'insensitive' } },
      include: { parent: true }
    });

    if (catRecord) {
      if (catRecord.isAwin && catRecord.parent && !catRecord.parent.isAwin) {
        return { id: catRecord.parent.id, name: catRecord.parent.name };
      }
      return { id: catRecord.id, name: catRecord.name };
    }

    try {
      const newCat = await (this.prisma as any).category.create({
        data: {
          name: cleanName,
          slug: cleanName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `cat-${Date.now()}`,
          isAwin: true,
        }
      });
      return { id: newCat.id, name: newCat.name };
    } catch (e) {
      const existing = await (this.prisma as any).category.findFirst({
        where: { name: cleanName }
      });
      return existing ? { id: existing.id, name: existing.name } : null;
    }
  }



  async deduplicateProducts() {
    this.logger.log('Starting global product deduplication...');
    const allProducts = await (this.prisma as any).product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        colour: true,
        imageUrl: true,
        productUrl: true,
        colorVariants: true,
        rawRow: true,
      }
    });

    const groups = new Map<string, any[]>();

    allProducts.forEach((p: any) => {
      // Create a "Core Name" by stripping common variant terms
      let coreName = p.name
        .toLowerCase()
        .replace(/\b(red|blue|green|black|white|grey|gray|yellow|pink|purple|brown|beige|cream|teal|navy|charcoal|silver|gold|orange)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (coreName.length < 5) coreName = p.name.toLowerCase().trim();

      const key = `${coreName}`;
      const group = groups.get(key) || [];
      group.push(p);
      groups.set(key, group);
    });

    let mergedCount = 0;
    let variantCount = 0;

    let batchInserts: any[] = [];
    let batchDeletes: string[] = [];
    const BATCH_SIZE = 1000;

    const flushBatches = async (inserts: any[], deletes: string[]) => {
      try {
        if (inserts.length > 0) {
          const insertQuery = `
            INSERT INTO "ProductColorVariant" (id, product_id, color_name, image_url, product_url, awin_id)
            VALUES ${inserts.map((_, i) => `(gen_random_uuid(), $${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
            ON CONFLICT DO NOTHING
          `;
          const flatInserts = inserts.flat();
          await this.prisma.$executeRawUnsafe(insertQuery, ...flatInserts);
        }

        if (deletes.length > 0) {
          const deleteQuery = `
            DELETE FROM "AWIN_AFFILIAT_PRODUCTS_DATA_PROD"
            WHERE "aw_product_id" IN (${deletes.map((_, i) => `$${i + 1}`).join(', ')})
          `;
          await this.prisma.$executeRawUnsafe(deleteQuery, ...deletes);
        }
      } catch (e) {
        this.logger.error(`Batch operation failed: ${e.message}`);
        throw e;
      }
    };

    for (const [key, products] of groups.entries()) {
      if (products.length <= 1) continue;

      const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
      const master = sorted[0];
      const variants = sorted.slice(1);

      const seenColors = new Set<string>();
      const masterColor = master.colour || master.name.split(' ').find((word: string) =>
        ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold', 'orange'].includes(word.toLowerCase())
      );
      if (masterColor) seenColors.add(masterColor.toLowerCase());

      for (const v of variants) {
        const colorName = v.colour || v.name.split(' ').find((word: string) =>
          ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold', 'orange'].includes(word.toLowerCase())
        ) || 'Original';

        const colorKey = colorName.toLowerCase();

        batchDeletes.push(v.id);
        mergedCount++;
        variantCount++;

        if (seenColors.has(colorKey)) {
          if (batchDeletes.length >= BATCH_SIZE) {
            await flushBatches(batchInserts, batchDeletes);
            this.logger.log(`Merged ${mergedCount} products...`);
            batchInserts = [];
            batchDeletes = [];
          }
          continue;
        }
        seenColors.add(colorKey);

        // Extract best image for the variant from rawRow if available
        let rawData: any = {};
        if (v.rawRow) {
          try {
            rawData = typeof v.rawRow === 'string' ? JSON.parse(v.rawRow) : v.rawRow;
          } catch (e) { /* ignore */ }
        }

        const candidates = [
          v.imageUrl,
          rawData.alternate_image,
          rawData.alternate_image_two,
          rawData.alternate_image_three,
          rawData.alternate_image_four,
          rawData.merchant_image_url,
          rawData.merchant_thumb_url,
        ];

        let bestImage = v.imageUrl || '';
        for (const candidate of candidates) {
          if (candidate && !candidate.includes('noimage.gif')) {
            bestImage = candidate;
            break;
          }
        }

        const finalImage = bestImage.includes('noimage.gif') ? null : bestImage;
        batchInserts.push([master.id, colorName, finalImage, v.productUrl || '', v.id]);
        batchDeletes.push(v.id);

        mergedCount++;
        variantCount++;

        if (batchInserts.length >= BATCH_SIZE) {
          await flushBatches(batchInserts, batchDeletes);
          this.logger.log(`Merged ${mergedCount} products...`);
          batchInserts = [];
          batchDeletes = [];
        }
      }
    }

    // Flush remaining
    if (batchInserts.length > 0) {
      await flushBatches(batchInserts, batchDeletes);
    }

    this.logger.log(`Deduplication complete. Merged ${mergedCount} products into variants.`);
    return { mergedCount, variantCount };
  }
}
