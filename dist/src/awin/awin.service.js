"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AwinService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwinService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const prisma_service_1 = require("../prisma.service");
const rxjs_1 = require("rxjs");
const cheerio = __importStar(require("cheerio"));
const csv = __importStar(require("fast-csv"));
const zlib = __importStar(require("zlib"));
const import_status_service_1 = require("./import-status.service");
let AwinService = AwinService_1 = class AwinService {
    httpService;
    prisma;
    statusService;
    logger = new common_1.Logger(AwinService_1.name);
    constructor(httpService, prisma, statusService) {
        this.httpService = httpService;
        this.prisma = prisma;
        this.statusService = statusService;
    }
    slugify(text) {
        if (!text)
            return `product-${Date.now()}`;
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    async addProductFromUrl(input) {
        const urls = input.split(/[\n\r\t]+/).map(u => u.trim()).filter(Boolean);
        if (urls.length === 0)
            return { message: 'No valid URLs provided' };
        const results = [];
        for (const url of urls) {
            try {
                if (url.includes('datafeed/download')) {
                    const jobId = `feed-${Date.now()}`;
                    this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting feed import...');
                    this.processFeed(url, jobId).catch(e => {
                        this.statusService.failJob(jobId, e.message);
                    });
                    results.push({ url, status: 'started', jobId });
                }
                else {
                    const res = await this.scrapeSingleProduct(url);
                    results.push({ url, status: 'success', data: res });
                }
            }
            catch (error) {
                this.logger.error(`Error processing URL ${url}: ${error.message}`);
                results.push({ url, status: 'error', error: error.message });
            }
        }
        return results.length === 1 ? results[0].data : { results };
    }
    async processFeed(url, jobId) {
        if (url.includes('datafeed/download') && !url.includes('/columns/')) {
            if (!url.endsWith('/'))
                url += '/';
            url += 'columns/any/format/csv/compression/gzip/';
        }
        this.logger.log(`Processing Awin Feed: ${url}`);
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, { responseType: 'stream' }));
            const stream = response.data;
            const isGzip = url.includes('compression/gzip') ||
                response.headers['content-encoding'] === 'gzip' ||
                url.endsWith('.gz');
            let count = 0;
            let parserStream = stream;
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
                    count++;
                    if (count % 10 === 0) {
                        this.logger.log(`Imported ${count} products...`);
                        if (jobId) {
                            this.statusService.updateJob(jobId, count, `Imported ${count} products...`);
                        }
                    }
                }
                catch (err) {
                    this.logger.error(`Error saving product ${row.aw_product_id}: ${err.message}`);
                }
            }
            this.logger.log(`Feed processing complete. Total imported: ${count}`);
            if (jobId) {
                this.statusService.completeJob(jobId, `Successfully imported ${count} products.`);
            }
            return { message: 'Feed processed successfully', count };
        }
        catch (error) {
            this.logger.error(`Failed to process feed: ${error.message}`);
            throw error;
        }
    }
    async scrapeSingleProduct(url) {
        this.logger.log(`Scraping single product from URL: ${url}`);
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                },
                timeout: 10000,
            }));
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
            let price = 0;
            const priceMeta = $('meta[property="product:price:amount"]').attr('content') ||
                $('meta[name="twitter:data1"]').attr('content') ||
                $('[itemprop="price"]').attr('content');
            if (priceMeta) {
                price = parseFloat(priceMeta.replace(/[^0-9.]/g, '')) || 0;
            }
            const currency = $('meta[property="product:price:currency"]').attr('content') ||
                $('meta[itemprop="priceCurrency"]').attr('content') || 'GBP';
            const category = $('meta[property="product:category"]').attr('content') ||
                $('meta[property="product:section"]').attr('content') ||
                $('meta[name="category"]').attr('content') ||
                'collection';
            const safeCategory = (category || 'collection').toLowerCase().trim();
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
                    category: safeCategory,
                    merchant: this.extractMerchant(url),
                    merchantProductId: awinId,
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
        }
        catch (error) {
            this.logger.error(`Failed to add product: ${error.message}`);
            throw error;
        }
    }
    extractMerchant(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname;
        }
        catch {
            return 'Awin Merchant';
        }
    }
    extractLeafCategory(path) {
        if (!path)
            return 'collection';
        const parts = path.split(/\s*[>|]\s*|\s*&gt;\s*/);
        return parts[parts.length - 1].trim() || 'collection';
    }
};
exports.AwinService = AwinService;
exports.AwinService = AwinService = AwinService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        prisma_service_1.PrismaService,
        import_status_service_1.ImportStatusService])
], AwinService);
//# sourceMappingURL=awin.service.js.map