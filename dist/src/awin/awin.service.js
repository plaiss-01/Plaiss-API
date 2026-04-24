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
let AwinService = AwinService_1 = class AwinService {
    httpService;
    prisma;
    logger = new common_1.Logger(AwinService_1.name);
    constructor(httpService, prisma) {
        this.httpService = httpService;
        this.prisma = prisma;
    }
    slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    async addProductFromUrl(url) {
        if (url.includes('datafeed/download')) {
            return this.processFeed(url);
        }
        return this.scrapeSingleProduct(url);
    }
    async processFeed(url) {
        this.logger.log(`Processing Awin Feed: ${url}`);
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, { responseType: 'stream' }));
            const stream = response.data;
            let count = 0;
            const parser = stream
                .pipe(zlib.createGunzip())
                .pipe(csv.parse({ headers: true }));
            for await (const row of parser) {
                try {
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
                }
                catch (err) {
                    this.logger.error(`Error saving product ${row.aw_product_id}: ${err.message}`);
                }
            }
            this.logger.log(`Feed processing complete. Total imported: ${count}`);
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
};
exports.AwinService = AwinService;
exports.AwinService = AwinService = AwinService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        prisma_service_1.PrismaService])
], AwinService);
//# sourceMappingURL=awin.service.js.map