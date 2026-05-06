import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import * as csv from 'fast-csv';
import * as zlib from 'zlib';
import { Readable } from 'stream';

import { ImportStatusService } from './import-status.service';
import { CategoryService } from '../category/category.service';

@Injectable()
export class AwinService {
  private readonly logger = new Logger(AwinService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly statusService: ImportStatusService,
    private readonly categoryService: CategoryService,
  ) {}

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
             const existing = await this.prisma.product.findUnique({ where: { awinId: potentialAwinId } });
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
    let internalCategoryId: string | null = null;
    if (finalCategory && finalCategory !== 'collection') {
      const catRec = await this.getOrCreateCategoryRecord(finalCategory);
      if (catRec) {
        finalCategory = catRec.name;
        internalCategoryId = catRec.id;
      }
    }
    
    // Ensure product has basic complete attributes
    const finalPrice = parseFloat(getVal(['search_price', 'price'])) || 0;
    const finalImageUrl = (getVal(['aw_image_url', 'large_image', 'merchant_image_url', 'image_url', 'alternate_image', 'image', 'aw_thumb_url']) || '').replace('http://', 'https://');
    
    if (!productName || productName === 'Unknown Product' || finalPrice === 0 || !finalImageUrl || !finalCategory || finalCategory === 'collection') {
       throw new Error(`Product has incomplete attributes. Name: ${productName}, Price: ${finalPrice}, Category: ${finalCategory}. Must not import.`);
    }

    const productData: any = {
      name: productName,
      slug: this.slugify(productName, awProductId),
      internalCategoryId,
      description: getVal(['description', 'product_description']),
      price: parseFloat(getVal(['search_price', 'price'])) || 0,
      currency: getVal(['currency']),
      imageUrl: (getVal([
        'aw_image_url',
        'large_image',
        'merchant_image_url', 
        'image_url', 
        'alternate_image', 
        'image',
        'aw_thumb_url'
      ]) || '').replace('http://', 'https://'),
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

    if (mainProductIdToUse && colour) {
       // Save as variant
       await (this.prisma as any).productColorVariant.upsert({
          where: { awinId: awProductId },
          update: {
             colorName: colour,
             imageUrl: productData.imageUrl,
             productUrl: productData.productUrl,
             productId: mainProductIdToUse
          },
          create: {
             awinId: awProductId,
             colorName: colour,
             imageUrl: productData.imageUrl,
             productUrl: productData.productUrl,
             productId: mainProductIdToUse
          }
       });
       return { id: mainProductIdToUse, isVariant: true };
    }

    // Mapping Awin CSV columns to our schema
    const product = await (this.prisma as any).product.upsert({
      where: { awinId: awProductId },
      update: productData,
      create: {
        ...productData,
        awinId: awProductId,
      },
    });

    // Normalize attributes for refining
    await this.normalizeProductAttributes(product.id, {
      Brand: productData.brandName,
      Colour: productData.colour,
      Condition: productData.condition,
      ProductType: productData.productType,
      Model: productData.productModel,
      Material: getVal(['material']),
      Size: getVal(['size'])
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
      let internalCategoryId: string | null = null;
      let finalCategoryName = safeCategory;
      if (safeCategory && safeCategory !== 'collection') {
        const catRec = await this.getOrCreateCategoryRecord(safeCategory);
        if (catRec) {
          internalCategoryId = catRec.id;
          finalCategoryName = catRec.name;
        }
      }

      const product = await (this.prisma as any).product.upsert({
        where: { awinId: awinId },
        update: {
          name,
          slug: this.slugify(name, awinId),
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          category: finalCategoryName,
          internalCategoryId,
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
          internalCategoryId,
          merchant: this.extractMerchant(url),
          merchantProductId: awinId,
        },
      });

      // Normalize Attributes for single products if any attributes are present
      // Currently scrapeSingleProduct doesn't extract full attributes, but we ensure the hook exists
      await this.normalizeProductAttributes(product.id, {
        Brand: '',
        Colour: '',
        Condition: ''
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

  private async normalizeProductAttributes(productId: string, attributesMap: Record<string, string | undefined | null>) {
    for (const [attrName, attrValue] of Object.entries(attributesMap)) {
      if (!attrValue || attrValue.trim() === '') continue;
      
      const cleanValue = attrValue.trim();
      const cleanName = attrName.trim();

      // Ensure Attribute exists
      const attribute = await (this.prisma as any).attribute.upsert({
        where: { name: cleanName },
        update: {},
        create: { name: cleanName },
      });

      // Ensure AttributeValue exists
      const attributeValue = await (this.prisma as any).attributeValue.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value: cleanValue } },
        update: {},
        create: { value: cleanValue, attributeId: attribute.id },
      });

      // Link to Product
      await (this.prisma as any).productAttribute.upsert({
        where: { productId_attributeId: { productId, attributeId: attribute.id } },
        update: { attributeValueId: attributeValue.id },
        create: { productId, attributeId: attribute.id, attributeValueId: attributeValue.id },
      });
    }
  }

  async deduplicateProducts() {
    this.logger.log('Starting global product deduplication...');
    const allProducts = await (this.prisma as any).product.findMany({
      include: { colorVariants: true },
    });

    const groups = new Map<string, any[]>();

    allProducts.forEach((p: any) => {
      // Create a "Core Name" by stripping common variant terms
      let coreName = p.name
        .toLowerCase()
        .replace(/\b(fabric|leather|velvet|chenille|linen|wood|metal|glass|gloss|matt|oak|pine|walnut|ash|marble)\b/gi, '')
        .replace(/\b(\d+)\s*(seater|piece|set|pack|kg|g|cm|mm|m)\b/gi, '')
        .replace(/^[0-9\s-]+/, '') // Strip leading numbers
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

    for (const [key, products] of groups.entries()) {
      if (products.length <= 1) continue;

      // Pick the best "Master" product (e.g., one with the most information or first imported)
      const sorted = products.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
      const master = sorted[0];
      const variants = sorted.slice(1);

      for (const v of variants) {
        try {
          // Check if it already has color info
          const colorName = v.colour || v.name.split(' ').find((word: string) => 
            ['red', 'blue', 'green', 'black', 'white', 'grey', 'gray', 'yellow', 'pink', 'purple', 'brown', 'beige', 'cream', 'teal', 'navy', 'charcoal', 'silver', 'gold'].includes(word.toLowerCase())
          ) || 'Original';

          // Create variant
          await (this.prisma as any).productColorVariant.upsert({
            where: { awinId: v.awinId },
            update: {
              colorName,
              imageUrl: v.imageUrl,
              productUrl: v.productUrl,
              productId: master.id,
            },
            create: {
              awinId: v.awinId,
              colorName,
              imageUrl: v.imageUrl,
              productUrl: v.productUrl,
              productId: master.id,
            },
          });

          // Move any existing variants of 'v' to 'master'
          if (v.colorVariants && v.colorVariants.length > 0) {
             await (this.prisma as any).productColorVariant.updateMany({
                where: { productId: v.id },
                data: { productId: master.id }
             });
          }

          // Delete the duplicate product
          await (this.prisma as any).product.delete({ where: { id: v.id } });
          mergedCount++;
          variantCount++;
        } catch (err) {
          this.logger.error(`Failed to merge ${v.name} into ${master.name}: ${err.message}`);
        }
      }
    }

    this.logger.log(`Deduplication complete. Merged ${mergedCount} products into variants.`);
    return { mergedCount, variantCount };
  }
}

