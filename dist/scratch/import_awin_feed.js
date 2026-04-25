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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const csv = __importStar(require("fast-csv"));
const zlib = __importStar(require("zlib"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});
const databaseUrl = env['DATABASE_URL'];
if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in .env');
}
const pool = new pg_1.Pool({ connectionString: databaseUrl });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
function slugify(text) {
    if (!text)
        return `product-${Math.random().toString(36).substr(2, 9)}`;
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
async function main() {
    const url = 'https://productdata.awin.com/datafeed/download/apikey/c2c3e805ebd99d73d9a8eb334715631e/language/en/cid/473/fid/80153/rid/0/hasEnhancedFeeds/0/columns/aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,category_name,category_id,aw_image_url,currency,store_price,delivery_cost,merchant_deep_link,language,last_updated,display_price,data_feed_id,brand_name,brand_id,colour,product_short_description,specifications,condition,product_model,model_number,dimensions,keywords,promotional_text,product_type,commission_group,merchant_product_category_path,merchant_product_second_category,merchant_product_third_category,rrp_price,saving,savings_percent,base_price,base_price_amount,base_price_text,product_price_old,delivery_restrictions,delivery_weight,warranty,terms_of_contract,delivery_time,in_stock,stock_quantity,valid_from,valid_to,is_for_sale,web_offer,pre_order,stock_status,size_stock_status,size_stock_amount,merchant_thumb_url,large_image,alternate_image,aw_thumb_url,alternate_image_two,alternate_image_three,alternate_image_four,reviews,average_rating,rating,number_available,custom_1,custom_2,custom_3,custom_4,custom_5,custom_6,custom_7,custom_8,custom_9,ean,isbn,upc,mpn,parent_product_id,product_GTIN,basket_link/format/csv/delimiter/%2C/compression/gzip/';
    console.log('Clearing existing products for full update...');
    await prisma.product.deleteMany({});
    console.log(`Processing Awin Feed (Full Mapping): ${url}`);
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'stream' });
    const stream = response.data;
    let batch = [];
    let totalImported = 0;
    const parser = stream
        .pipe(zlib.createGunzip())
        .pipe(csv.parse({ headers: true }));
    for await (const row of parser) {
        if (totalImported < 50 && batch.length < 50) {
            console.log(`Row ${totalImported + batch.length}: ${row.product_name}`);
        }
        const price = parseFloat(row.search_price) || 0;
        const name = row.product_name || 'Unknown Product';
        batch.push({
            awinId: row.aw_product_id,
            name: name,
            slug: slugify(name),
            description: row.description,
            price: price,
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
        });
        if (batch.length >= 1000) {
            try {
                const result = await prisma.product.createMany({
                    data: batch,
                    skipDuplicates: true,
                });
                totalImported += result.count;
                console.log(`Imported batch of ${result.count} (Total: ${totalImported})...`);
                batch = [];
            }
            catch (err) {
                console.error(`Error saving batch: ${err.message}`);
                batch = [];
            }
        }
    }
    if (batch.length > 0) {
        try {
            const result = await prisma.product.createMany({
                data: batch,
                skipDuplicates: true,
            });
            totalImported += result.count;
        }
        catch (err) {
            console.error(`Error saving final batch: ${err.message}`);
        }
    }
    console.log(`Feed processing complete. Total imported: ${totalImported}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=import_awin_feed.js.map