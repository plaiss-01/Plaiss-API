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

  private slugify(text: string | undefined | null) {
    if (!text) return `product-${Date.now()}`;
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async addProductFromUrl(input: string) {
    // Split by newlines, commas, or spaces to support bulk links
    const urls = input.split(/[\n\r\t]+/).map(u => u.trim()).filter(Boolean);
    
    if (urls.length === 0) return { message: 'No valid URLs provided' };

    const results: any[] = [];
    for (const url of urls) {
      try {
        if (url.includes('datafeed/download')) {
          const jobId = `feed-${Date.now()}`;
          this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting feed import...');
          
          // We don't await here so the controller can return the jobId
          this.processFeed(url, jobId).catch(e => {
            this.statusService.failJob(jobId, e.message);
          });
          
          results.push({ url, status: 'started', jobId });
        } else {
          const res = await this.scrapeSingleProduct(url);
          results.push({ url, status: 'success', data: res });
        }
      } catch (error) {
        this.logger.error(`Error processing URL ${url}: ${error.message}`);
        results.push({ url, status: 'error', error: error.message });
      }
    }

    return results.length === 1 ? results[0].data : { results };
  }


  async processFeed(url: string, jobId?: string) {
    // Ensure Awin URLs have necessary parameters to avoid 400 errors
    if (url.includes('datafeed/download') && !url.includes('/columns/')) {
      if (!url.endsWith('/')) url += '/';
      url += 'columns/any/format/csv/compression/gzip/';
    }

    this.logger.log(`Processing Awin Feed: ${url}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'stream' })
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


      for await (const row of parser) {
        try {
          if (!row.aw_product_id || !row.product_name) {
            this.logger.warn(`Skipping malformed row: Missing product ID or name`);
            continue;
          }
          await this.upsertProduct(row);

          count++;
          if (count % 10 === 0) {
            this.logger.log(`Imported ${count} products...`);
            if (jobId) {
              this.statusService.updateJob(jobId, count, `Imported ${count} products...`);
            }
          }
        } catch (err) {
          this.logger.error(`Error saving product ${row.aw_product_id}: ${err.message}`);
        }
      }

      this.logger.log(`Feed processing complete. Total imported: ${count}`);
      if (jobId) {
        this.statusService.completeJob(jobId, `Successfully imported ${count} products.`);
      }
      return { message: 'Feed processed successfully', count };
    } catch (error) {
      this.logger.error(`Failed to process feed: ${error.message}`);
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
      this.logger.error(`Failed to process CSV file: ${error.message}`);
      this.statusService.failJob(jobId, error.message);
      throw error;
    }
  }

  private async upsertProduct(row: any) {
    // Auto-sync category
    if (row.category_name) {
      await this.categoryService.create({ name: row.category_name, isAwin: true }).catch(() => {});
    }

    // Mapping Awin CSV columns to our schema
    return (this.prisma as any).product.upsert({
      where: { awinId: row.aw_product_id },
      update: {
        name: row.product_name,
        slug: this.slugify(row.product_name),
        description: row.description,
        price: parseFloat(row.search_price) || 0,
        currency: row.currency,
        imageUrl: row.merchant_image_url || row.aw_image_url,
        productUrl: row.aw_deep_link,
        merchant: row.merchant_name,
        category: this.extractLeafCategory(row.category_name || row.merchant_product_category_path),
        // New Awin Fields
        merchantProductId: row.merchant_product_id,
        merchantCategory: row.merchant_category,
        merchantId: row.merchant_id,
        categoryId: row.category_id,
        storePrice: parseFloat(row.store_price) || null,
        deliveryCost: parseFloat(row.delivery_cost) || null,
        merchantDeepLink: row.merchant_deep_link,
        language: row.language,
        lastUpdated: row.last_updated,
        displayPrice: row.display_price,
        dataFeedId: row.data_feed_id,
        brandName: row.brand_name,
        brandId: row.brand_id,
        colour: row.colour,
        productShortDescription: row.product_short_description,
        specifications: row.specifications,
        condition: row.condition,
        productModel: row.product_model,
        modelNumber: row.model_number,
        dimensions: row.dimensions,
        keywords: row.keywords,
        promotionalText: row.promotional_text,
        productType: row.product_type,
        commissionGroup: row.commission_group,
        merchantProductCategoryPath: row.merchant_product_category_path,
        merchantProductSecondCategory: row.merchant_product_second_category,
        merchantProductThirdCategory: row.merchant_product_third_category,
        rrpPrice: parseFloat(row.rrp_price) || null,
        saving: parseFloat(row.saving) || null,
        savingsPercent: row.savings_percent,
        basePrice: parseFloat(row.base_price) || null,
        basePriceAmount: parseFloat(row.base_price_amount) || null,
        basePriceText: row.base_price_text,
        productPriceOld: parseFloat(row.product_price_old) || null,
        deliveryRestrictions: row.delivery_restrictions,
        deliveryWeight: row.delivery_weight,
        warranty: row.warranty,
        termsOfContract: row.terms_of_contract,
        deliveryTime: row.delivery_time,
        inStock: row.in_stock,
        stockQuantity: parseInt(row.stock_quantity) || null,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        isForSale: row.is_for_sale,
        webOffer: row.web_offer,
        preOrder: row.pre_order,
        stockStatus: row.stock_status,
        sizeStockStatus: row.size_stock_status,
        sizeStockAmount: row.size_stock_amount,
        merchantThumbUrl: row.merchant_thumb_url,
        largeImage: row.large_image,
        alternateImage: row.alternate_image,
        awThumbUrl: row.aw_thumb_url,
        alternateImageTwo: row.alternate_image_two,
        alternateImageThree: row.alternate_image_three,
        alternateImageFour: row.alternate_image_four,
        reviews: row.reviews,
        averageRating: row.average_rating,
        rating: row.rating,
        numberAvailable: row.number_available,
        custom1: row.custom_1,
        custom2: row.custom_2,
        custom3: row.custom_3,
        custom4: row.custom_4,
        custom5: row.custom_5,
        custom6: row.custom_6,
        custom7: row.custom_7,
        custom8: row.custom_8,
        custom9: row.custom_9,
        ean: row.ean,
        isbn: row.isbn,
        upc: row.upc,
        mpn: row.mpn,
        parentProductId: row.parent_product_id,
        productGTIN: row.product_GTIN,
        basketLink: row.basket_link,
      },
      create: {
        awinId: row.aw_product_id,
        name: row.product_name,
        slug: this.slugify(row.product_name),
        description: row.description,
        price: parseFloat(row.search_price) || 0,
        currency: row.currency,
        imageUrl: row.merchant_image_url || row.aw_image_url,
        productUrl: row.aw_deep_link,
        merchant: row.merchant_name,
        category: this.extractLeafCategory(row.category_name || row.merchant_product_category_path),
        // New Awin Fields
        merchantProductId: row.merchant_product_id,
        merchantCategory: row.merchant_category,
        merchantId: row.merchant_id,
        categoryId: row.category_id,
        storePrice: parseFloat(row.store_price) || null,
        deliveryCost: parseFloat(row.delivery_cost) || null,
        merchantDeepLink: row.merchant_deep_link,
        language: row.language,
        lastUpdated: row.last_updated,
        displayPrice: row.display_price,
        dataFeedId: row.data_feed_id,
        brandName: row.brand_name,
        brandId: row.brand_id,
        colour: row.colour,
        productShortDescription: row.product_short_description,
        specifications: row.specifications,
        condition: row.condition,
        productModel: row.product_model,
        modelNumber: row.model_number,
        dimensions: row.dimensions,
        keywords: row.keywords,
        promotionalText: row.promotional_text,
        productType: row.product_type,
        commissionGroup: row.commission_group,
        merchantProductCategoryPath: row.merchant_product_category_path,
        merchantProductSecondCategory: row.merchant_product_second_category,
        merchantProductThirdCategory: row.merchant_product_third_category,
        rrpPrice: parseFloat(row.rrp_price) || null,
        saving: parseFloat(row.saving) || null,
        savingsPercent: row.savings_percent,
        basePrice: parseFloat(row.base_price) || null,
        basePriceAmount: parseFloat(row.base_price_amount) || null,
        basePriceText: row.base_price_text,
        productPriceOld: parseFloat(row.product_price_old) || null,
        deliveryRestrictions: row.delivery_restrictions,
        deliveryWeight: row.delivery_weight,
        warranty: row.warranty,
        termsOfContract: row.terms_of_contract,
        deliveryTime: row.delivery_time,
        inStock: row.in_stock,
        stockQuantity: parseInt(row.stock_quantity) || null,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        isForSale: row.is_for_sale,
        webOffer: row.web_offer,
        preOrder: row.pre_order,
        stockStatus: row.stock_status,
        sizeStockStatus: row.size_stock_status,
        sizeStockAmount: row.size_stock_amount,
        merchantThumbUrl: row.merchant_thumb_url,
        largeImage: row.large_image,
        alternateImage: row.alternate_image,
        awThumbUrl: row.aw_thumb_url,
        alternateImageTwo: row.alternate_image_two,
        alternateImageThree: row.alternate_image_three,
        alternateImageFour: row.alternate_image_four,
        reviews: row.reviews,
        averageRating: row.average_rating,
        rating: row.rating,
        numberAvailable: row.number_available,
        custom1: row.custom_1,
        custom2: row.custom_2,
        custom3: row.custom_3,
        custom4: row.custom_4,
        custom5: row.custom_5,
        custom6: row.custom_6,
        custom7: row.custom_7,
        custom8: row.custom_8,
        custom9: row.custom_9,
        ean: row.ean,
        isbn: row.isbn,
        upc: row.upc,
        mpn: row.mpn,
        parentProductId: row.parent_product_id,
        productGTIN: row.product_GTIN,
        basketLink: row.basket_link,
      },
    });
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
      
      if (priceMeta) {
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

      // Try to get a unique Awin ID or similar from URL to prevent duplicates
      const awinIdMatch = url.match(/[?&]aw_product_id=([^&]+)/) || url.match(/\/p\/([^/?]+)/);
      const awinId = awinIdMatch ? awinIdMatch[1] : `manual-${Date.now()}`;

      // Auto-sync category
      if (safeCategory) {
        await this.categoryService.create({ name: safeCategory, isAwin: true }).catch(() => {});
      }

      const product = await (this.prisma as any).product.upsert({
        where: { awinId: awinId },
        update: {
          name,
          slug: this.slugify(name),
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          category: safeCategory,
          merchant: this.extractMerchant(url),
          // New fields support for single product scraping
          merchantProductId: awinId, // Use awinId if specific merchant ID is not scraped
        },
        create: {
          awinId,
          name,
          slug: this.slugify(name),
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          category: category.toLowerCase().trim(),
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
}

