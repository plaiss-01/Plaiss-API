import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import * as csv from 'fast-csv';
import * as zlib from 'zlib';
import { Readable } from 'stream';

@Injectable()
export class AwinService {
  private readonly logger = new Logger(AwinService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  private slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async addProductFromUrl(url: string) {
    if (url.includes('datafeed/download')) {
      return this.processFeed(url);
    }
    return this.scrapeSingleProduct(url);
  }

  async processFeed(url: string) {
    this.logger.log(`Processing Awin Feed: ${url}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'stream' })
      );
      
      const stream = response.data as Readable;
      let count = 0;

      const parser = stream
        .pipe(zlib.createGunzip())
        .pipe(csv.parse({ headers: true }));

      for await (const row of parser) {
        try {
          // Mapping Awin CSV columns to our schema
          await this.prisma.product.upsert({
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
              category: row.category_name,
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
              category: row.category_name,
            },
          });
          count++;
          if (count % 100 === 0) {
            this.logger.log(`Imported ${count} products...`);
          }
        } catch (err) {
          this.logger.error(`Error saving product ${row.aw_product_id}: ${err.message}`);
        }
      }

      this.logger.log(`Feed processing complete. Total imported: ${count}`);
      return { message: 'Feed processed successfully', count };
    } catch (error) {
      this.logger.error(`Failed to process feed: ${error.message}`);
      throw error;
    }
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

      // Try to get a unique Awin ID or similar from URL to prevent duplicates
      const awinIdMatch = url.match(/[?&]aw_product_id=([^&]+)/) || url.match(/\/p\/([^/?]+)/);
      const awinId = awinIdMatch ? awinIdMatch[1] : `manual-${Date.now()}`;

      const product = await this.prisma.product.upsert({
        where: { awinId: awinId },
        update: {
          name,
          slug: this.slugify(name),
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          category: category.toLowerCase().trim(),
          merchant: this.extractMerchant(url),
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
}
