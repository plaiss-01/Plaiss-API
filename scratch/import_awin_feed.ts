import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as csv from 'fast-csv';
import * as zlib from 'zlib';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Manual .env loader
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
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

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function slugify(text: string) {
  if (!text) return `product-${Math.random().toString(36).substr(2, 9)}`;
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getOrCreateCategory(
  pathString: string | null | undefined, 
  categoryCache: Map<string, string>, 
  prisma: PrismaClient
): Promise<string | null> {
  if (!pathString || pathString.trim() === '') return null;

  const parts = pathString.split('>').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  let currentSlugPath = '';

  for (const part of parts) {
    const slug = slugify(part);
    const fullSlug = currentSlugPath ? `${currentSlugPath}-${slug}` : slug;
    
    if (categoryCache.has(fullSlug)) {
      parentId = categoryCache.get(fullSlug)!;
    } else {
      // Find by slug OR name to avoid @unique constraint errors on name
      let category = await prisma.category.findFirst({
        where: { OR: [{ slug: fullSlug }, { name: part }] }
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            name: part,
            slug: fullSlug,
            parentId,
            isAwin: true,
          }
        });
      } else if (!category.isAwin || category.parentId !== parentId) {
        // Just update it to be awin and set parentId if it's missing
        category = await prisma.category.update({
          where: { id: category.id },
          data: { 
            isAwin: true,
            parentId: category.parentId || parentId 
          }
        });
      }

      categoryCache.set(fullSlug, category.id);
      parentId = category.id;
    }
    currentSlugPath = fullSlug;
  }

  return parentId; // returns the leaf category ID
}

async function main() {
  const url = 'https://productdata.awin.com/datafeed/download/apikey/c2c3e805ebd99d73d9a8eb334715631e/language/en/cid/449/hasEnhancedFeeds/0/columns/aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,category_name,category_id,aw_image_url,currency,store_price,delivery_cost,merchant_deep_link,language,last_updated,display_price,data_feed_id,brand_name,brand_id,colour,product_short_description,specifications,condition,product_model,model_number,dimensions,keywords,promotional_text,product_type,commission_group,merchant_product_category_path,merchant_product_second_category,merchant_product_third_category,rrp_price,saving,savings_percent,base_price,base_price_amount,base_price_text,product_price_old,delivery_restrictions,delivery_weight,warranty,terms_of_contract,delivery_time,in_stock,stock_quantity,valid_from,valid_to,is_for_sale,web_offer,pre_order,stock_status,size_stock_status,size_stock_amount,merchant_thumb_url,large_image,alternate_image,aw_thumb_url,alternate_image_two,alternate_image_three,alternate_image_four,reviews,average_rating,rating,number_available,custom_1,custom_2,custom_3,custom_4,custom_5,custom_6,custom_7,custom_8,custom_9,ean,isbn,upc,mpn,parent_product_id,product_GTIN,basket_link,Fashion%3Asuitable_for,Fashion%3Acategory,Fashion%3Asize,Fashion%3Amaterial,Fashion%3Apattern,Fashion%3Aswatch,GroupBuying%3Aevent_date,GroupBuying%3Aexpiry_date,GroupBuying%3Aexpiry_time,GroupBuying%3Aevent_city,GroupBuying%3Aevent_address,GroupBuying%3Anumber_sessions,GroupBuying%3Aterms,GroupBuying%3Anumber_sold,GroupBuying%3Amin_required,GroupBuying%3Asupplier,GroupBuying%3Agroup_latitude,GroupBuying%3Agroup_longitude,GroupBuying%3Adeal_start,GroupBuying%3Adeal_end,ShoppingNL%3Aenergy_label,ShoppingNL%3Aenergy_label_link,ShoppingNL%3Aenergy_label_logo,ShoppingNL%3Agoogle_taxonomy/format/csv/delimiter/%2C/compression/gzip/adultcontent/1/';

  console.log('Updating products (creating new ones and updating categories for existing)...');

  console.log('Pre-loading categories...');
  const existingCategories = await prisma.category.findMany();
  const categoryCache = new Map<string, string>();
  for (const cat of existingCategories) {
    categoryCache.set(cat.slug, cat.id);
  }

  console.log(`Processing Awin Feed: ${url}`);
  const response = await axios.get(url, { responseType: 'stream' });
  
  const stream = response.data as Readable;
  let batch: any[] = [];
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
    
    // Fallback logic: Use product_type if available, otherwise merchant_category
    let categoryString = row.product_type;
    if (!categoryString || categoryString.trim() === '') {
      categoryString = row.merchant_category;
    }

    const mappedCategoryId = await getOrCreateCategory(categoryString, categoryCache, prisma);

    // Find first image that isn't a broken placeholder
    let imageUrl = '';
    const imageCandidates = [row.merchant_image_url, row.large_image, row.aw_image_url, row.image_url];
    for (const img of imageCandidates) {
      if (img && !img.includes('noimage.gif') && !img.includes('no_image')) {
        imageUrl = img;
        break;
      }
    }
    if (!imageUrl) imageUrl = row.merchant_image_url || row.large_image || row.aw_image_url || '';

    batch.push({
      awinId: row.aw_product_id,
      name: name,
      slug: slugify(name) + '-' + row.aw_product_id,
      description: row.description,
      price: price,
      currency: row.currency,
      imageUrl: imageUrl.replace('http://', 'https://'),
      productUrl: row.aw_deep_link,
      merchant: row.merchant_name,
      category: row.category_name,

      merchantProductId: row.merchant_product_id,
      merchantCategory: row.merchant_category,
      merchantId: row.merchant_id,
      categoryId: mappedCategoryId || row.category_id,
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

    if (batch.length >= 200) {
      try {
        // Try parallel processing first for speed
        const operations = batch.map(async (item) => {
          if (item.parentProductId && item.parentProductId !== item.awinId) {
            const parent = await prisma.product.findUnique({ where: { id: item.parentProductId } });
            if (parent) {
              return prisma.productColorVariant.upsert({
                where: { awinId: item.awinId },
                update: {
                  colorName: item.colour || 'Original',
                  imageUrl: item.imageUrl,
                  productUrl: item.productUrl,
                  productId: parent.id
                },
                create: {
                  awinId: item.awinId,
                  colorName: item.colour || 'Original',
                  imageUrl: item.imageUrl,
                  productUrl: item.productUrl,
                  productId: parent.id
                }
              });
            }
          }
          
          return prisma.product.upsert({
            where: { id: item.awinId },
            update: {
              categoryId: item.categoryId,
              category: item.category,
              productType: item.productType,
              colour: item.colour,
              merchantCategory: item.merchantCategory,
            },
            create: item
          });
        });

        await Promise.all(operations);
        totalImported += batch.length;
        console.log(`Fast-processed batch of ${batch.length} (Total: ${totalImported})...`);
        batch = [];
      } catch (err: any) {
        console.log(`Parallel batch failed (${err.message}). Falling back to safe sequential mode for this batch...`);
        // Fallback to safe sequential processing for this batch
        for (const item of batch) {
          if (item.parentProductId && item.parentProductId !== item.awinId) {
            const parent = await prisma.product.findUnique({ where: { id: item.parentProductId } });
            if (parent) {
              await prisma.productColorVariant.upsert({
                where: { awinId: item.awinId },
                update: { colorName: item.colour || 'Original', imageUrl: item.imageUrl, productUrl: item.productUrl, productId: parent.id },
                create: { awinId: item.awinId, colorName: item.colour || 'Original', imageUrl: item.imageUrl, productUrl: item.productUrl, productId: parent.id }
              });
              continue;
            }
          }
          
          try {
            await prisma.product.upsert({
              where: { id: item.awinId },
              update: { categoryId: item.categoryId, category: item.category, productType: item.productType, colour: item.colour },
              create: item
            });
          } catch (upsertErr: any) {
            if (upsertErr.message.includes('slug')) {
              item.slug = `${item.slug}-${Math.random().toString(36).substr(2, 5)}`;
              await prisma.product.upsert({
                where: { id: item.awinId },
                update: { categoryId: item.categoryId, category: item.category, productType: item.productType, colour: item.colour },
                create: item
              });
            } else {
              throw upsertErr;
            }
          }
        }
        totalImported += batch.length;
        console.log(`Seq-processed batch of ${batch.length} (Total: ${totalImported})...`);
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    try {
      const operations = batch.map(async (item) => {
        if (item.parentProductId && item.parentProductId !== item.awinId) {
          const parent = await prisma.product.findUnique({ where: { id: item.parentProductId } });
          if (parent) {
            return prisma.productColorVariant.upsert({
              where: { awinId: item.awinId },
              update: { colorName: item.colour || 'Original', imageUrl: item.imageUrl, productUrl: item.productUrl, productId: parent.id },
              create: { awinId: item.awinId, colorName: item.colour || 'Original', imageUrl: item.imageUrl, productUrl: item.productUrl, productId: parent.id }
            });
          }
        }
        return prisma.product.upsert({
          where: { id: item.awinId },
          update: { categoryId: item.categoryId, category: item.category, productType: item.productType, colour: item.colour },
          create: item
        });
      });
      await Promise.all(operations);
      totalImported += batch.length;
    } catch (err: any) {
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
