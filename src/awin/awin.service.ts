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

      return new Promise((resolve, reject) => {
        stream
          .pipe(zlib.createGunzip())
          .pipe(csv.parse({ headers: true }))
          .on('data', async (row) => {
            try {
              // Mapping Awin CSV columns to our schema
              await this.prisma.product.upsert({
                where: { awinId: row.aw_product_id },
                update: {
                  name: row.product_name,
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
          })
          .on('end', () => {
            this.logger.log(`Feed processing complete. Total imported: ${count}`);
            resolve({ message: 'Feed processed successfully', count });
          })
          .on('error', (error) => {
            this.logger.error(`Feed processing failed: ${error.message}`);
            reject(error);
          });
      });
    } catch (error) {
      this.logger.error(`Failed to fetch feed: ${error.message}`);
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
          },
        }),
      );

      const html = response.data;
      const $ = cheerio.load(html);

      const name = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Unknown Product';
      const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
      const imageUrl = $('meta[property="og:image"]').attr('content') || '';
      const productUrl = url;

      let price = 0;
      let currency = 'USD';

      const priceMeta = $('meta[property="product:price:amount"]').attr('content') || $('meta[name="twitter:data1"]').attr('content');
      if (priceMeta) {
        price = parseFloat(priceMeta.replace(/[^0-9.]/g, ''));
      }
      
      const currencyMeta = $('meta[property="product:price:currency"]').attr('content') || 'USD';
      currency = currencyMeta;

      const product = await this.prisma.product.create({
        data: {
          name,
          description,
          price,
          currency,
          imageUrl,
          productUrl,
          merchant: this.extractMerchant(url),
        },
      });

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
