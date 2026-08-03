// Triggering reload after prisma generate
import { Controller, Post, Body, Get, Patch, Delete, Param, Query, UseInterceptors, UploadedFile, Logger, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AwinService } from './awin.service';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportStatusService } from './import-status.service';
import { CategoryService } from '../category/category.service';
import { LIGHTING_RULES, FURNITURE_RULES } from './product-type.util';

// Every label deriveProductType can produce. Used to tell a Type-facet value
// (match product_type_clean exactly) from a Lighting sidebar category name
// (match loosely against the raw breadcrumb), since both arrive as ?types=.
const CANONICAL_PRODUCT_TYPES = new Set(
  [...LIGHTING_RULES, ...FURNITURE_RULES].map(([label]) => label.toLowerCase()),
);

// /tables was 667 products of which only 25 were tables: 309 bar stools, 196
// chairs, 99 stools and 30 table lamps, pulled in because "Dining Tables &
// Chairs" and "table lamp" both contain the term. Filtering on the product NAME
// does not fix it — "Dining Table With 4 Black Chairs" and "ORION Rosella table
// lamp" both contain "table", so a name test still left 191 chairs and every
// lamp. Only the canonical type separates a table from the chairs sold with it.
//
// Hoisted because the catalogue has BOTH a curated "Tables" child under
// Furniture and a leftover singular "table" root, and the nav links to each.
// getExcludedTypesFor matches the category name exactly, so both spellings
// need the rule or one of the two pages stays contaminated.
const TABLE_EXCLUSIONS = [
  'Bar Stool',
  'Stool',
  'Footstool',
  'Chair',
  'Dining Chair',
  'Office Chair',
  'Garden Chair',
  'Bench',
  'Bean Bag',
  'Cushion',
  // Lighting leaking in on the word "table" - this is the ORION Rosella
  // table lamp Rishi flagged.
  'Table Lamp',
  'Floor Lamp',
  'Lamp Shade',
  'Sofa',
  'Corner Sofa',
  'Sofa Bed',
  'Armchair',
  'Recliner',
];

// Canonical types that must never surface under a given category, keyed by the
// lowercased category name. Categories are matched by text against the feed's
// breadcrumbs, so a term leaks into everything that merely contains the word:
// "bed" pulled in 669 sofa beds and 393 armchairs against just 282 bed frames.
// Excluding by canonical type is exact, where excluding by name would also
// remove a genuine "Bed Frame with Sofa-Style Headboard".
const CATEGORY_TYPE_EXCLUSIONS: Record<string, string[]> = {
  bed: [
    'Sofa Bed',
    'Sofa',
    'Corner Sofa',
    'Armchair',
    'Recliner',
    'Chair',
    'Dining Chair',
    'Office Chair',
    'Garden Chair',
    'Bar Stool',
    'Stool',
    'Footstool',
    'Bean Bag',
    'Bench',
    'Desk',
    // Bedroom-adjacent but not a bed. Kept here initially, removed because it
    // reads as clutter on a page whose job is to show beds.
    'Bedside Table',
  ],
  // /tables was 667 products of which only 25 were tables: 309 bar stools, 196
  // chairs, 99 stools and 30 table lamps, pulled in because "Dining Tables &
  // Chairs" and "table lamp" both contain the term. Filtering on the product
  // NAME does not fix this — "Dining Table With 4 Black Chairs" and "ORION
  // Rosella table lamp" both contain "table", so a name test still left 191
  // chairs and every lamp. Excluding by canonical type is the only thing that
  // separates a table from the chairs sold beside it.
  tables: TABLE_EXCLUSIONS,
  table: TABLE_EXCLUSIONS,
  // 45 corner sofas were landing here, matched on "storage" appearing in
  // descriptions like "corner sofa with storage footstool". Dressing tables
  // stay — they have drawers and read as storage furniture.
  storage: [
    'Corner Sofa',
    'Sofa',
    'Sofa Bed',
    'Armchair',
    'Recliner',
    'Chair',
    'Dining Chair',
    'Office Chair',
    'Bar Stool',
    'Stool',
    'Footstool',
    'Bean Bag',
  ],
};

@ApiTags('awin')
@Controller('awin')
export class AwinController implements OnApplicationBootstrap {
  private readonly logger = new Logger(AwinController.name);

  constructor(
    private readonly awinService: AwinService,
    private readonly prisma: PrismaService,
    private readonly statusService: ImportStatusService,
    private readonly categoryService: CategoryService,
  ) { }

  async onApplicationBootstrap() {
    // Ensure the trigram search indexes exist BEFORE warmup. `prisma db push` on boot drops
    // any index not declared in schema.prisma, and these GIN/pg_trgm indexes are created here
    // (not in the schema), so they must be re-ensured every boot or category ILIKE queries
    // fall back to full seq scans (facets/products go from <1s to 90s+). Idempotent.
    await this.ensureSearchIndexes();

    const categories = ['Plants', 'Sofas', 'Lighting', 'Chairs', 'Decor'];
    this.logger.log('[Warmup] Pre-populating product + facets cache for popular categories...');
    await Promise.all(
      categories.map(async (cat) => {
        try {
          await Promise.all([
            this.getAllProducts('1', '24', cat),
            this.getFacets(cat),
          ]);
          this.logger.log(`[Warmup] Cached products+facets: ${cat}`);
        } catch (e) {
          this.logger.warn(`[Warmup] Failed for ${cat}: ${e.message}`);
        }
      })
    );
    this.logger.log('[Warmup] Done.');
  }

  // Recreate the pg_trgm GIN indexes that back fast category/search ILIKE queries. These live
  // outside schema.prisma so `prisma db push` drops them on every boot — without them the
  // sofas/lighting facet + product queries seq-scan the whole table (90s+). IF NOT EXISTS makes
  // this a no-op once they're present, so it only actually rebuilds after a push has dropped them.
  private async ensureSearchIndexes() {
    const statements = [
      // start.sh runs `prisma db push` fail-soft, so a schema change can
      // silently not apply and the app then boots against a column that isn't
      // there — warmup calls getFacets, the groupBy throws, and the revision
      // never becomes healthy. Guarantee the columns the code depends on here,
      // the same way the trigram indexes are guaranteed below.
      `ALTER TABLE "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" ADD COLUMN IF NOT EXISTS product_type_clean text`,
      `ALTER TABLE "AWIN_AFFILIAT_PRODUCTS_DATA_DEV" ADD COLUMN IF NOT EXISTS product_type_clean text`,
      `CREATE INDEX IF NOT EXISTS prod_product_type_clean_idx ON "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" (product_type_clean)`,
      `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
      `CREATE INDEX IF NOT EXISTS prod_category_trgm_idx ON "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" USING gin (category_name gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS prod_name_trgm_idx ON "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" USING gin (product_name gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS prod_merchant_category_trgm_idx ON "AWIN_AFFILIAT_PRODUCTS_DATA_PROD" USING gin (merchant_category gin_trgm_ops)`,
    ];
    for (const sql of statements) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (e: any) {
        this.logger.warn(`[Index] ensure failed (continuing): ${e?.message ?? e}`);
      }
    }
    this.logger.log('[Index] schema columns and trigram search indexes ensured');
  }

  private productsCache = new Map<string, { data: any, timestamp: number }>();
  private facetsCache = new Map<string, { data: any, timestamp: number }>();
  private readonly CACHE_TTL = 1800000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cached queries
  private readonly productListSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    price: true,
    currency: true,
    imageUrl: true,
    productUrl: true,
    merchant: true,
    category: true,
    merchantProductId: true,
    merchantCategory: true,
    categoryId: true,
    brandName: true,
    colour: true,
    productModel: true,
    productType: true,
    createdAt: true,
    rawRow: true,
    productModelClean: true,
    colourClean: true,
    sizeStockStatusClean: true,
    // Required by the frontend's Type filter. Without it the client falls back
    // to substring-matching category/productType and silently drops most of
    // the rows the server just matched.
    productTypeClean: true,
    isRecliner: true,
    isSofaBed: true,
    baseSku: true,
    colourVariantNumber: true,
    originalPriceClean: true,
    discountedPriceClean: true,
    saving: true,
    colorVariants: {
      select: {
        id: true,
        colorName: true,
        imageUrl: true,
        productUrl: true,
        awinId: true,
      }
    },
  };

  private isUsableImageValue(value?: string | null): value is string {
    if (!value) return false;
    const trimmed = value.trim();
    return !!trimmed && !/^(?:n\/?a|na|none|null|undefined|no\s+image(?:\s+available)?|image\s+(?:not\s+)?available|not\s+available|missing|-+)$/i.test(trimmed);
  }

  private decodeProductServeSource(value?: string | null): string {
    if (!value) return '';

    let decoded = value.trim();
    for (let i = 0; i < 2; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }

    if (/^ssl:/i.test(decoded)) {
      return `https://${decoded.replace(/^ssl:\/?/i, '').replace(/^\/+/, '')}`;
    }
    if (/^https?:\/\//i.test(decoded)) {
      return decoded.replace(/^http:\/\//i, 'https://');
    }
    if (/^\/\//.test(decoded)) {
      return `https:${decoded}`;
    }
    if (/^[a-z0-9.-]+\//i.test(decoded)) {
      return `https://${decoded}`;
    }

    return '';
  }

  private normalizeProductImageUrl(value?: string | null, size: number = 900): string {
    if (!this.isUsableImageValue(value)) return '';

    const secureValue = value.trim().replace(/^http:\/\//i, 'https://');
    try {
      const parsed = new URL(secureValue);
      if (parsed.hostname.includes('productserve.com')) {
        const directSource = this.decodeProductServeSource(parsed.searchParams.get('url'));
        if (directSource) return directSource;

        parsed.searchParams.set('w', String(size));
        parsed.searchParams.set('h', String(size));
        if (!parsed.searchParams.has('bg')) parsed.searchParams.set('bg', 'white');
        if (!parsed.searchParams.has('t')) parsed.searchParams.set('t', 'letterbox');
        return parsed.toString();
      }
      return secureValue;
    } catch {
      return secureValue;
    }
  }

  private getBestProductImage(product: any): string {
    let rawData: any = {};
    if (product.rawRow) {
      try {
        rawData = typeof product.rawRow === 'string' ? JSON.parse(product.rawRow) : product.rawRow;
      } catch (e) {
        // ignore
      }
    }

    const candidates = [
      product?.largeImage,
      product?.imageUrl,
      rawData.alternate_image,
      rawData.alternate_image_two,
      rawData.alternate_image_three,
      rawData.alternate_image_four,
      product?.alternateImage,
      rawData.merchant_image_url,
      rawData.merchant_thumb_url,
      product?.merchantThumbUrl,
      product?.awThumbUrl,
    ];

    for (const candidate of candidates) {
      const image = this.normalizeProductImageUrl(candidate);
      if (image && !image.includes('noimage.gif')) return image;
    }

    // Fallback to the first candidate if all fail (or return empty)
    return candidates[0] || '';
  }

  private normalizeDeliveryTime(raw: string): string {
    let s = raw.trim();
    // "2 - 10 Working Days" / "5-7 working days" → strip "working", keep "days"
    s = s.replace(/\s*working\s+days/i, ' days');
    // Collapse spaces around dashes: "2 - 10" → "2-10"
    s = s.replace(/\s*-\s*/g, '-');
    return s.trim();
  }

  private enhanceProductImages(product: any) {
    if (!product) return product;

    const img = this.getBestProductImage(product);

    let rawData: any = {};
    if (product.rawRow) {
      try {
        rawData = typeof product.rawRow === 'string' ? JSON.parse(product.rawRow) : product.rawRow;
      } catch {
        // ignore
      }
    }

    const raw =
      rawData.delivery_time ||
      product.deliveryTime ||
      'N/A';

    const deliveryTime = this.normalizeDeliveryTime(raw);

    return {
      ...product,
      imageUrl: img,
      image: img,
      images: img ? [img] : [],
      colorVariants: product.colorVariants || [],
      colors: (() => {
        // Poltronesofà at SCS embeds hardware colours (e.g. "black plastic feet") in the raw
        // `colour` field, so it is unreliable for this merchant; `colourClean` is derived from the
        // authoritative fabric colour (custom_3) — see inferAwinColour in awin.service.ts. Prefer
        // the clean colour here so the displayed swatch matches the real fabric, not the feet.
        const isPoltronesofaScs = /poltronesof/i.test(product.merchant || '');
        const colorName = isPoltronesofaScs
          ? product.colourClean || product.colour || null
          : product.colour || product.colourClean || null;
        return colorName ? [{ name: colorName, hex: colorName, imageUrl: img, productUrl: product.productUrl }] : [];
      })(),
      normalizedAttributes: {},
      deliveryTime,
    };
  }

  private isUnderLighting(catId?: string | null, categoryMap?: Map<string, any>): boolean {
    if (!catId || !categoryMap) return false;
    let current = categoryMap.get(catId);
    while (current) {
      if (current.name.toLowerCase() === 'lighting' || current.slug.toLowerCase() === 'lighting') {
        return true;
      }
      current = current.parentId ? categoryMap.get(current.parentId) : null;
    }
    return false;
  }

  /**
   * Walks up from a category to find which CATEGORY_TYPE_EXCLUSIONS entry
   * applies, so children inherit their parent's rules. Bed has eleven of them
   * — Guest Beds, Bed Frames, Kids Bed Frames, King Size Fabric Beds and so on
   * — and keying the exclusions on the requested category alone meant a sofa
   * bed excluded from /bed still showed under /guest-beds.
   */
  private getExcludedTypesFor(
    category?: string | null,
    targetCats?: any[],
    categoryMap?: Map<string, any>,
  ): string[] | undefined {
    const direct = CATEGORY_TYPE_EXCLUSIONS[(category || '').trim().toLowerCase()];
    if (direct) return direct;

    for (const cat of targetCats || []) {
      let current = categoryMap?.get(cat.id) ?? cat;
      while (current) {
        const byName = CATEGORY_TYPE_EXCLUSIONS[(current.name || '').toLowerCase()];
        const bySlug = CATEGORY_TYPE_EXCLUSIONS[(current.slug || '').toLowerCase()];
        if (byName || bySlug) return byName || bySlug;
        current = current.parentId ? categoryMap?.get(current.parentId) : null;
      }
    }
    return undefined;
  }

  private getCategoryTerms(name: string): string[] {
    const terms = [name];
    const lower = name.toLowerCase();
    
    // Plural to singular rules
    if (lower.endsWith('ies')) {
      terms.push(name.slice(0, -3) + 'y');
    } else if (lower.endsWith('es') && (lower.endsWith('ches') || lower.endsWith('shes') || lower.endsWith('xes'))) {
      terms.push(name.slice(0, -2));
    } else if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('as')) {
      terms.push(name.slice(0, -1));
    }
    
    // Singular to plural rules
    if (lower.endsWith('y') && !lower.endsWith('ey') && !lower.endsWith('ay') && !lower.endsWith('oy') && !lower.endsWith('uy')) {
      terms.push(name.slice(0, -1) + 'ies');
    } else if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x')) {
      terms.push(name + 'es');
    } else if (!lower.endsWith('s')) {
      terms.push(name + 's');
    }

    return Array.from(new Set(terms));
  }

  @Get('pipeline/tables')
  @ApiOperation({ summary: 'Get AWIN raw/dev/prod pipeline table names' })
  async getPipelineTables() {
    return this.awinService.getAwinPipelineTableSummary();
  }

  @Post('pipeline/extract-raw')
  @ApiOperation({ summary: 'Step 1: Extract AWIN data into AWIN_AFFILIAT_PRODUCTS_DATA_RAW' })
  async extractRaw(@Body() body: { url: string; replace?: boolean }) {
    if (!body || !body.url) {
      throw new BadRequestException('URL is required');
    }
    const jobId = `awin-raw-${Date.now()}`;
    this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN RAW extraction...');

    this.awinService.extractAwinFeedToRaw(body.url, jobId, body.replace !== false).catch((e) => {
      this.statusService.failJob(jobId, e.message);
    });

    return {
      jobId,
      message: 'AWIN RAW extraction started',
      table: this.awinService.getAwinPipelineTableNames().raw,
    };
  }

  @Post('pipeline/upload-raw-csv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Step 1 alternative: Upload AWIN CSV into AWIN_AFFILIAT_PRODUCTS_DATA_RAW' })
  async uploadRawCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { replace?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const jobId = `awin-raw-csv-${Date.now()}`;
    this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN CSV RAW extraction...');

    this.awinService.extractCsvFileToRaw(file.buffer, jobId, body.replace !== 'false').catch((e) => {
      this.statusService.failJob(jobId, e.message);
    });

    return {
      jobId,
      message: 'AWIN CSV RAW extraction started',
      table: this.awinService.getAwinPipelineTableNames().raw,
    };
  }

  @Post('pipeline/transform-dev')
  @ApiOperation({ summary: 'Step 2: Transform AWIN RAW data into AWIN_AFFILIAT_PRODUCTS_DATA_DEV' })
  async transformDev(@Body() body: { replace?: boolean }) {
    const jobId = `awin-transform-dev-${Date.now()}`;
    this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN DEV transform...');

    this.awinService.transformRawToDev(body?.replace !== false, jobId).catch((e) => {
      this.statusService.failJob(jobId, e.message);
    });

    return {
      jobId,
      message: 'AWIN DEV transform started',
      sourceTable: this.awinService.getAwinPipelineTableNames().raw,
      targetTable: this.awinService.getAwinPipelineTableNames().dev,
    };
  }

  @Post('pipeline/promote-prod')
  @ApiOperation({ summary: 'Step 3: Promote reviewed AWIN DEV data into AWIN_AFFILIAT_PRODUCTS_DATA_PROD' })
  async promoteProd(@Body() body: { replace?: boolean; syncProductTable?: boolean }) {
    const jobId = `awin-promote-prod-${Date.now()}`;
    this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting AWIN PROD promotion...');

    this.awinService
      .loadDevToProd(
        body?.replace !== false,
        body?.syncProductTable !== false,
        jobId,
      )
      .then(() => { this.productsCache.clear(); this.facetsCache.clear(); })
      .catch((e) => {
        this.statusService.failJob(jobId, e.message);
      });

    this.productsCache.clear();
    this.facetsCache.clear();
    return {
      jobId,
      message: 'AWIN PROD promotion started',
      sourceTable: this.awinService.getAwinPipelineTableNames().dev,
      targetTable: this.awinService.getAwinPipelineTableNames().prod,
    };
  }

  @Post('add-product')
  @ApiOperation({ summary: 'Add a new product using an Awin URL' })
  @ApiResponse({ status: 201, description: 'The product has been successfully created.' })
  async addProduct(@Body() createProductDto: CreateProductDto) {
    return this.awinService.addProductFromUrl(createProductDto.url);
  }

  @Post('upload-csv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a CSV file of products' })
  async uploadCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const jobId = `csv-${Date.now()}`;
    this.statusService.setJob(jobId, 0, 100, 'processing', 'Starting CSV file import...');

    // Process in background
    this.awinService.processCsvFile(file.buffer, jobId).catch(e => {
      this.statusService.failJob(jobId, e.message);
    });

    return { jobId, message: 'CSV import started' };
  }

  @Get('import-status/:id')
  @ApiOperation({ summary: 'Get the status of an import job' })
  async getImportStatus(@Param('id') id: string) {
    return this.statusService.getJob(id);
  }

  @Get('products/mix-brands')
  @ApiOperation({ summary: 'Fetch mixed brands products by category names' })
  async getMixBrandsProducts(
    @Query('categories') categories: string,
    @Query('limit') limit: string = '50',
  ) {
    const categoryNames = categories.split(',').map(c => c.trim()).filter(Boolean);
    const l = parseInt(limit, 10) || 50;

    const where: any = {
      category: { in: categoryNames, mode: 'insensitive' },
      AND: [
        { brandName: { not: null } },
        { brandName: { not: '' } },
      ]
    };

    const products = await this.prisma.product.findMany({
      where,
      take: l,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        brandName: true,
        category: true,
        merchant: true,
      }
    });

    return products.map((product: any) => this.enhanceProductImages(product));
  }

  @Get('facets')
  @ApiOperation({ summary: 'Get unique facets for filters based on category' })
  async getFacets(
    @Query('category') category?: string,
    @Query('subs') subs?: string,
  ) {
    const facetsCacheKey = `facets-${category || 'all'}-${subs || 'none'}`;
    const now = Date.now();
    if (this.facetsCache.has(facetsCacheKey)) {
      const cached = this.facetsCache.get(facetsCacheKey)!;
      if (now - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const isAllProducts = !category || category.toLowerCase() === 'all-products';
    if (isAllProducts && !subs) {
      const priceAgg = await (this.prisma.product as any).aggregate({
        _min: { discountedPriceClean: true, price: true },
        _max: { discountedPriceClean: true, price: true },
      });
      const minVal = priceAgg._min.discountedPriceClean ?? priceAgg._min.price;
      const maxVal = priceAgg._max.discountedPriceClean ?? priceAgg._max.price;
      const allProductsFacets = {
        sizes: [], colors: [], materials: [], merchants: [], types: [],
        priceMin: Math.floor(minVal ?? 0),
        priceMax: Math.ceil(maxVal ?? 0),
      };
      this.facetsCache.set(facetsCacheKey, { data: allProductsFacets, timestamp: now });
      return allProductsFacets;
    }

    const where: any = {};
    const allCategoryNames: string[] = [];
    const allCategoryIds: string[] = [];

    const { data: allCats, categoryMap, childrenMap } = await this.categoryService.getCategoryStructure();

    const targetCats = category ? allCats.filter(c =>
      c.slug.toLowerCase() === category.toLowerCase() ||
      c.name.toLowerCase() === category.toLowerCase()
    ) : [];

    if (category) {

      const getDescendantIds = (catId: string, visited = new Set<string>()): string[] => {
        if (visited.has(catId)) return [];
        visited.add(catId);
        let ids = [catId];
        const children = childrenMap.get(catId) || [];
        for (const child of children) {
          ids = ids.concat(getDescendantIds(child.id, visited));
        }
        return ids;
      };

      for (const cat of targetCats) {
        const children = childrenMap.get(cat.id) || [];
        if (children.length > 0) {
          for (const child of children) {
            const descendantIds = getDescendantIds(child.id);
            allCategoryIds.push(...descendantIds);
            
            // If NOT under lighting, add descendant terms
            if (!this.isUnderLighting(child.id, categoryMap)) {
              allCategoryNames.push(...this.getCategoryTerms(child.name));
            }
          }
        } else {
          allCategoryIds.push(cat.id);
          // If NOT under lighting, add terms
          if (!this.isUnderLighting(cat.id, categoryMap)) {
            allCategoryNames.push(...this.getCategoryTerms(cat.name));
          }
        }
      }
    }

    if (subs) {
      const subArray = subs.split(',').map(s => s.replace(/\+/g, ' ').trim());
      
      // Also try to find IDs for these sub names
      const subCats = allCats.filter(c => subArray.some(s => s.toLowerCase() === c.name.toLowerCase()));
      allCategoryIds.push(...subCats.map(c => c.id));

      // For subs NOT under lighting, we should ALWAYS add their names/terms to allCategoryNames
      for (const subName of subArray) {
        const subCat = allCats.find(c => c.name.toLowerCase() === subName.toLowerCase());
        if (!subCat || !this.isUnderLighting(subCat.id, categoryMap)) {
          allCategoryNames.push(...this.getCategoryTerms(subName));
        }
      }
    }

    let uniqueIds = Array.from(new Set(allCategoryIds));
    let uniqueNames = Array.from(new Set(allCategoryNames));

    // Include the requested category's own terms alongside any subcategory
    // terms. Sofas passes subs=one-seater,two-seater,three-seater — orphan
    // categories no product actually uses — so matching on the subs alone
    // returned zero rows and every facet came back empty, leaving the sidebar
    // with only Price and Colour. Lighting is the exception: its subs-only
    // narrowing is deliberate and paired with the furniture exclusion above.
    // This mirrors the same fix already made in getAllProducts (bffdcbc).
    if (category && (!subs || !this.isUnderLighting(targetCats[0]?.id, categoryMap))) {
      const categoryTerms = this.isUnderLighting(targetCats[0]?.id, categoryMap)
        ? [category]
        : this.getCategoryTerms(category);
      for (const term of categoryTerms) {
        if (!uniqueNames.some(n => n.toLowerCase() === term.toLowerCase())) {
          uniqueNames.push(term);
        }
      }
    }

    if (uniqueIds.length > 0 || uniqueNames.length > 0) {
      where.OR = [];
      if (uniqueIds.length > 0) {
        // Fix categoryId field mismatch -> use categoryRel!
        where.OR.push({ categoryRel: { id: { in: uniqueIds } } });
      }
      if (uniqueNames.length > 0) {
        where.OR.push({
          OR: uniqueNames.map(name => ({
            category: { contains: name, mode: 'insensitive' as const }
          }))
        });
        where.OR.push({
          OR: uniqueNames.map(name => ({
            merchantCategory: { contains: name, mode: 'insensitive' as const }
          }))
        });
      }

      // If the root category is Lighting or a subcategory of Lighting, aggressively filter out miscategorized furniture
      let isLightingCategory = false;
      if (category && category.toLowerCase() === 'lighting') {
        isLightingCategory = true;
      } else {
          if (targetCats) {
            for (const cat of targetCats) {
              let currentCat = cat;
              while (currentCat) {
                if (currentCat.name.toLowerCase() === 'lighting' || currentCat.slug.toLowerCase() === 'lighting') {
                  isLightingCategory = true;
                  break;
                }
                currentCat = currentCat.parentId ? categoryMap.get(currentCat.parentId) : null;
              }
              if (isLightingCategory) break;
            }
          }
      }
      if (isLightingCategory) {
        const nonLightingTerms = [
          'chair', 'sofa', 'stool', 'bench', 'dining table', 'side table', 
          'coffee table', 'console table', 'dressing table', 'wardrobe', 
          'chest of drawers', 'mattress', 'bed frame', 'rug', 'pouffe', 
          'bar table', 'bistro table', 'bedside', 'ottoman'
        ];
        const notConditions = nonLightingTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' as const }
        }));
        
        // Ensure where.AND exists
        if (!where.AND) where.AND = [];
        where.AND.push({ NOT: { OR: notConditions } });
      }

      // If the category is Chairs (or a Chairs subcategory), exclude office/gaming/task chairs
      // so it shows home/dining/accent/recliner chairs only. Keeps 'swivel' and 'recliner'.
      let isChairsCategory = false;
      if (category && category.toLowerCase() === 'chairs') {
        isChairsCategory = true;
      } else if (targetCats) {
        for (const cat of targetCats) {
          let currentCat = cat;
          while (currentCat) {
            if (currentCat.name.toLowerCase() === 'chairs' || currentCat.slug.toLowerCase() === 'chairs') {
              isChairsCategory = true;
              break;
            }
            currentCat = currentCat.parentId ? categoryMap.get(currentCat.parentId) : null;
          }
          if (isChairsCategory) break;
        }
      }
      if (isChairsCategory) {
        const officeChairTerms = ['office', 'gaming', 'gamer', 'racing', 'executive', 'ergonomic', 'task chair', 'computer chair', 'desk chair'];
        const officeNot = officeChairTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' as const }
        }));
        if (!where.AND) where.AND = [];
        where.AND.push({ NOT: { OR: officeNot } });

        // Seat cushions and pillows were 4,081 of the 7,094 products here —
        // more than half the category. Excluded by canonical type rather than
        // by a name match, so an "Armchair with Cushion" (typed Armchair) is
        // kept. The null branch is required: `not` alone drops untyped rows,
        // because SQL `col <> 'Cushion'` is NULL, not true, when col IS NULL.
        where.AND.push({
          OR: [
            { productTypeClean: null },
            { productTypeClean: { not: 'Cushion' } },
          ],
        });
      }

      // The Furniture root aggregates the same products, so without this it
      // still leads with Cushion (4,093) while its Chairs child no longer
      // does. Root only — the other children (Sofas, Tables, Storage…) carry
      // no meaningful cushion count.
      if (category && category.toLowerCase() === 'furniture') {
        if (!where.AND) where.AND = [];
        where.AND.push({
          OR: [
            { productTypeClean: null },
            { productTypeClean: { not: 'Cushion' } },
          ],
        });
      }

      // Per-category type exclusions. The null branch keeps products we could
      // not type — dropping them would quietly delete ~7% of the catalogue.
      const excludedTypes = this.getExcludedTypesFor(
        category,
        targetCats,
        categoryMap,
      );
      if (excludedTypes?.length) {
        if (!where.AND) where.AND = [];
        where.AND.push({
          OR: [
            { productTypeClean: null },
            { productTypeClean: { notIn: excludedTypes } },
          ],
        });
      }
    }

    const [sizes, colors, materials, merchants, typeGroups] = await Promise.all([
      (this.prisma.product as any).findMany({
        where,
        distinct: ['sizeStockStatusClean'],
        select: { sizeStockStatusClean: true },
      }),
      (this.prisma.product as any).findMany({
        where,
        distinct: ['colourClean'],
        select: { colourClean: true },
      }),
      (this.prisma.product as any).findMany({
        where,
        distinct: ['productModelClean'],
        select: { productModelClean: true },
      }),
      (this.prisma.product as any).findMany({
        where,
        distinct: ['merchant'],
        select: { merchant: true },
      }),
      // Types carry counts because a category can surface a dozen of them and
      // the order matters to the user; the other facets are short lists.
      // Degrade to no Type facet rather than failing the whole sidebar if this
      // one query breaks — every other filter on the page depends on it too.
      (this.prisma.product as any)
        .groupBy({ by: ['productTypeClean'], where, _count: { _all: true } })
        .catch((e: any) => {
          this.logger.warn(`[Facets] type grouping failed: ${e?.message ?? e}`);
          return [];
        }),
    ]);

    // For prices, we can just do a simple findMany and calculate or use aggregate if available
    const priceAgg = await (this.prisma.product as any).aggregate({
      where,
      _min: { discountedPriceClean: true, price: true },
      _max: { discountedPriceClean: true, price: true },
    });
 
    const minPriceVal = priceAgg._min.discountedPriceClean ?? priceAgg._min.price;
    const maxPriceVal = priceAgg._max.discountedPriceClean ?? priceAgg._max.price;

    const facetsResult = {
      sizes: sizes.map((s: any) => s.sizeStockStatusClean).filter(Boolean),
      colors: colors.map((c: any) => c.colourClean).filter(Boolean),
      materials: materials.map((m: any) => m.productModelClean).filter(Boolean),
      merchants: merchants.map((m: any) => m.merchant).filter(Boolean),
      types: typeGroups
        .filter((t: any) => t.productTypeClean)
        .map((t: any) => ({ label: t.productTypeClean, count: t._count._all }))
        .sort((a: any, b: any) => b.count - a.count),
      priceMin: minPriceVal ?? 0,
      priceMax: maxPriceVal ?? 0,
    };

    if (this.facetsCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.facetsCache.keys().next().value;
      if (oldestKey) this.facetsCache.delete(oldestKey);
    }
    this.facetsCache.set(facetsCacheKey, { data: facetsResult, timestamp: now });

    return facetsResult;
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all saved products with pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated products.' })
  async getAllProducts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('category') category?: string,
    @Query('subs') subs?: string,
    @Query('search') search?: string,
    @Query('colors') colors?: string,
    @Query('sizes') sizes?: string,
    @Query('materials') materials?: string,
    @Query('merchants') merchants?: string,
    @Query('types') types?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    let l = parseInt(limit, 10) || 50;
    if (l > 1000) l = 1000; // Cap limit to prevent memory issues
    const skip = (p - 1) * l;

    const cacheKey = `products-${p}-${l}-${category || 'all'}-${subs || 'none'}-${search || 'none'}-${colors || 'none'}-${sizes || 'none'}-${materials || 'none'}-${merchants || 'none'}-${types || 'none'}-${minPrice || 'none'}-${maxPrice || 'none'}`;
    const now = Date.now();
    if (this.productsCache.has(cacheKey)) {
      const cached = this.productsCache.get(cacheKey)!;
      if (now - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const ARTIFICIAL_TERMS = ['artificial', 'plastic', 'fake', 'faux', 'synthetic'];
    // US-only merchants with slow image CDNs — irrelevant for UK audience
    const EXCLUDED_MERCHANTS = ['Flowers Fast', 'encalife'];
    const where: any = {
      imageUrl: { not: null },
      NOT: { imageUrl: '' },
      AND: [
        { NOT: { OR: ARTIFICIAL_TERMS.map(t => ({ name: { contains: t, mode: 'insensitive' as const } })) } },
        { OR: [{ colourVariantNumber: 1 }, { colourVariantNumber: null }] },
        { NOT: { OR: EXCLUDED_MERCHANTS.map(m => ({ merchant: { contains: m, mode: 'insensitive' as const } })) } },
      ],
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    } else if (category && category !== 'all-products') {
      const { data: allCats, categoryMap, childrenMap } = await this.categoryService.getCategoryStructure();

      // Find the requested categories
      const targetCats = allCats.filter(c =>
        c.slug.toLowerCase() === category.toLowerCase() ||
        c.name.toLowerCase() === category.toLowerCase()
      );

      const getDescendantIds = (catId: string, visited = new Set<string>()): string[] => {
        if (visited.has(catId)) return [];
        visited.add(catId);
        let ids = [catId];
        const children = childrenMap.get(catId) || [];
        for (const child of children) {
          ids = ids.concat(getDescendantIds(child.id, visited));
        }
        return ids;
      };

      const allCategoryIds: string[] = [];
      const allCategoryNames: string[] = [];

      for (const cat of targetCats) {
        const children = childrenMap.get(cat.id) || [];

        if (children.length > 0) {
          // STRICT COMBINATION: If category has children, ONLY use descendant IDs/Names
          // (exclude the parent's own ID and Name)
          for (const child of children) {
            const descendantIds = getDescendantIds(child.id);
            allCategoryIds.push(...descendantIds);
            
            // If NOT under lighting, add descendant terms to allCategoryNames
            if (!this.isUnderLighting(child.id, categoryMap)) {
              allCategoryNames.push(...this.getCategoryTerms(child.name));
            }
          }
        } else {
          // If category has NO children, use its own ID and Name
          allCategoryIds.push(cat.id);
          // If NOT under lighting, add terms to allCategoryNames
          if (!this.isUnderLighting(cat.id, categoryMap)) {
            allCategoryNames.push(...this.getCategoryTerms(cat.name));
          }
        }
      }

      if (subs) {
        const subArray = subs.split(',').map(s => s.replace(/\+/g, ' ').trim());
        
        // Also try to find IDs for these sub names
        const subCats = allCats.filter(c => subArray.some(s => s.toLowerCase() === c.name.toLowerCase()));
        allCategoryIds.push(...subCats.map(c => c.id));

        // For subs NOT under lighting, we should ALWAYS add their names/terms to allCategoryNames
        for (const subName of subArray) {
          const subCat = allCats.find(c => c.name.toLowerCase() === subName.toLowerCase());
          if (!subCat || !this.isUnderLighting(subCat.id, categoryMap)) {
            allCategoryNames.push(...this.getCategoryTerms(subName));
          }
        }
      }

      let uniqueIds = Array.from(new Set(allCategoryIds));
      let uniqueNames = Array.from(new Set(allCategoryNames));

      // Include the requested category's own name/terms alongside any subcategory terms.
      // Without this, a parent category whose subcategories match no products (e.g. the
      // orphan one/two/three-seater subcats under "Sofas") would return 0 rows and trip the
      // parent fallback, dumping the entire top-level "Furniture" bucket into the page.
      // Lighting is left untouched (its subcategory-only behaviour is intentional and paired
      // with the aggressive furniture exclusion below), so it keeps skipping when subs exist.
      if (category && (!subs || !this.isUnderLighting(targetCats[0]?.id, categoryMap))) {
        const categoryTerms = this.isUnderLighting(targetCats[0]?.id, categoryMap)
          ? [category]
          : this.getCategoryTerms(category);
        for (const term of categoryTerms) {
          if (!uniqueNames.some(n => n.toLowerCase() === term.toLowerCase())) {
            uniqueNames.push(term);
          }
        }
      }

      // FALLBACK LOGIC: If we found target categories but they have 0 products (check via pre-calculated count if possible, or just prepare OR)
      // Actually, it's better to do this after the query if total is 0. 
      // But we can also proactively add parents if the user wants "combination... if not available then use main".

      where.OR = [
        { categoryRel: { id: { in: uniqueIds } } },
        {
          OR: uniqueNames.map((name) => ({
            category: { contains: name, mode: 'insensitive' as const },
          })),
        },
        {
          OR: uniqueNames.map((name) => ({
            merchantCategory: { contains: name, mode: 'insensitive' as const },
          })),
        },
      ];

      // If the root category is Lighting or a subcategory of Lighting, aggressively filter out miscategorized furniture
      let isLightingCategory = false;
      if (category && category.toLowerCase() === 'lighting') {
        isLightingCategory = true;
      } else {
        for (const cat of targetCats) {
          let currentCat = cat;
          while (currentCat) {
            if (currentCat.name.toLowerCase() === 'lighting' || currentCat.slug.toLowerCase() === 'lighting') {
              isLightingCategory = true;
              break;
            }
            currentCat = currentCat.parentId ? categoryMap.get(currentCat.parentId) : null;
          }
          if (isLightingCategory) break;
        }
      }
      if (isLightingCategory) {
        const nonLightingTerms = [
          'chair', 'sofa', 'stool', 'bench', 'dining table', 'side table', 
          'coffee table', 'console table', 'dressing table', 'wardrobe', 
          'chest of drawers', 'mattress', 'bed frame', 'rug', 'pouffe', 
          'bar table', 'bistro table', 'bedside', 'ottoman'
        ];
        const notConditions = nonLightingTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' as const }
        }));
        
        // Ensure where.AND exists
        if (!where.AND) where.AND = [];
        where.AND.push({ NOT: { OR: notConditions } });
      }

      // If the category is Chairs (or a Chairs subcategory), exclude office/gaming/task chairs
      // so it shows home/dining/accent/recliner chairs only. Keeps 'swivel' and 'recliner'.
      let isChairsCategory = false;
      if (category && category.toLowerCase() === 'chairs') {
        isChairsCategory = true;
      } else if (targetCats) {
        for (const cat of targetCats) {
          let currentCat = cat;
          while (currentCat) {
            if (currentCat.name.toLowerCase() === 'chairs' || currentCat.slug.toLowerCase() === 'chairs') {
              isChairsCategory = true;
              break;
            }
            currentCat = currentCat.parentId ? categoryMap.get(currentCat.parentId) : null;
          }
          if (isChairsCategory) break;
        }
      }
      if (isChairsCategory) {
        const officeChairTerms = ['office', 'gaming', 'gamer', 'racing', 'executive', 'ergonomic', 'task chair', 'computer chair', 'desk chair'];
        const officeNot = officeChairTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' as const }
        }));
        if (!where.AND) where.AND = [];
        where.AND.push({ NOT: { OR: officeNot } });

        // Seat cushions and pillows were 4,081 of the 7,094 products here —
        // more than half the category. Excluded by canonical type rather than
        // by a name match, so an "Armchair with Cushion" (typed Armchair) is
        // kept. The null branch is required: `not` alone drops untyped rows,
        // because SQL `col <> 'Cushion'` is NULL, not true, when col IS NULL.
        where.AND.push({
          OR: [
            { productTypeClean: null },
            { productTypeClean: { not: 'Cushion' } },
          ],
        });
      }

      // The Furniture root aggregates the same products, so without this it
      // still leads with Cushion (4,093) while its Chairs child no longer
      // does. Root only — the other children (Sofas, Tables, Storage…) carry
      // no meaningful cushion count.
      if (category && category.toLowerCase() === 'furniture') {
        if (!where.AND) where.AND = [];
        where.AND.push({
          OR: [
            { productTypeClean: null },
            { productTypeClean: { not: 'Cushion' } },
          ],
        });
      }

      // Per-category type exclusions. The null branch keeps products we could
      // not type — dropping them would quietly delete ~7% of the catalogue.
      const excludedTypes = this.getExcludedTypesFor(
        category,
        targetCats,
        categoryMap,
      );
      if (excludedTypes?.length) {
        if (!where.AND) where.AND = [];
        where.AND.push({
          OR: [
            { productTypeClean: null },
            { productTypeClean: { notIn: excludedTypes } },
          ],
        });
      }
    }

    // Server-side filtering
    const hasFilters = colors || sizes || materials || merchants || types || minPrice || maxPrice;

    if (hasFilters) {
      const andConditions: any[] = [];

      if (colors) {
        const array = colors.replace(/\+/g, ' ').split(',').map(s => s.trim());
        andConditions.push({ OR: array.map(val => ({ colour: { equals: val, mode: 'insensitive' as const } })) });
      }
      if (sizes) {
        const array = sizes.replace(/\+/g, ' ').split(',').map(s => s.trim());
        const sizeConditions = array.flatMap(val => {
          const conds: any[] = [
            { sizeStockStatusClean: { contains: val, mode: 'insensitive' as const } },
            { productType: { contains: val, mode: 'insensitive' as const } },
          ];
          // X Seater → match product name ("2 seater", "2-seater", "2 seat")
          const seaterMatch = val.match(/^(\d+)\s+seat(?:er)?s?$/i);
          if (seaterMatch) {
            const num = seaterMatch[1];
            conds.push(
              { name: { contains: `${num} seat`, mode: 'insensitive' as const } },
              { name: { contains: `${num}-seat`, mode: 'insensitive' as const } },
            );
          }
          if (/corner|chaise|l.shape/i.test(val)) {
            conds.push(
              { name: { contains: 'corner', mode: 'insensitive' as const } },
              { name: { contains: 'chaise', mode: 'insensitive' as const } },
              { name: { contains: 'l-shape', mode: 'insensitive' as const } },
              { name: { contains: 'l shape', mode: 'insensitive' as const } },
            );
          }
          if (/sofa.bed|sofabed/i.test(val)) {
            conds.push(
              { name: { contains: 'sofa bed', mode: 'insensitive' as const } },
              { name: { contains: 'sofabed', mode: 'insensitive' as const } },
            );
          }
          return conds;
        });
        andConditions.push({ OR: sizeConditions });
      }
      if (materials) {
        const array = materials.replace(/\+/g, ' ').split(',').map(s => s.trim());
        andConditions.push({ OR: array.map(val => ({ productModelClean: { contains: val, mode: 'insensitive' as const } })) });
      }
      if (merchants) {
        const array = merchants.replace(/\+/g, ' ').split(',').map(s => s.trim());
        andConditions.push({ OR: array.map(val => ({ merchant: { equals: val, mode: 'insensitive' as const } })) });
      }
      if (types) {
        const array = types.replace(/\+/g, ' ').split(',').map(s => s.trim());
        andConditions.push({
          // A canonical type matches product_type_clean exactly and nothing
          // else. Mixing in the loose contains-matches made this endpoint
          // describe a different set from the facet count — ?types=Armchair
          // returned 531 rows by breadcrumb while the facet counted 533 by
          // canonical type, and the two disagreed about which rows.
          // Non-canonical values keep the loose match: the Lighting sidebar
          // passes raw category names through this same parameter.
          OR: array.flatMap((val): any[] =>
            CANONICAL_PRODUCT_TYPES.has(val.trim().toLowerCase())
              ? [{ productTypeClean: { equals: val, mode: 'insensitive' as const } }]
              : [
                  { productType: { contains: val, mode: 'insensitive' as const } },
                  { category: { contains: val, mode: 'insensitive' as const } },
                ],
          )
        });
      }
      if (minPrice || maxPrice) {
        const priceCond: any = {};
        if (minPrice) priceCond.gte = parseFloat(minPrice);
        if (maxPrice) priceCond.lte = parseFloat(maxPrice);
        andConditions.push({ price: priceCond });
      }

      if (hasFilters && andConditions.length > 0) {
        if (!where.AND) where.AND = [];
        where.AND.push(...andConditions);
      }
    }

    // Fast path: no category / no search / no filters → skip merchant interleaving,
    // use standard DB-level pagination (avoids loading all 133K IDs into memory).
    if (!category && !search && !hasFilters) {
      const [pageData, pageTotal] = await Promise.all([
        (this.prisma.product as any).findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: l,
          select: this.productListSelect,
        }),
        (this.prisma.product as any).count({ where }),
      ]);

      const result = {
        data: pageData.map((p: any) => this.enhanceProductImages(p)),
        meta: { total: pageTotal, page: p, limit: l, totalPages: Math.ceil(pageTotal / l) },
      };

      if (this.productsCache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.productsCache.keys().next().value;
        if (oldestKey) this.productsCache.delete(oldestKey);
      }
      this.productsCache.set(cacheKey, { data: result, timestamp: now });
      return result;
    }

    // For category/search: cap the ID pre-fetch to avoid loading the entire table.
    // 10 000 rows covers ~200 pages of 50; beyond that standard pagination kicks in anyway.
    let [idResults, total] = await Promise.all([
      (this.prisma.product as any).findMany({
        where,
        select: { id: true, merchant: true },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
      (this.prisma.product as any).count({ where }),
    ]);


    let data: any[] = [];
    if (idResults.length > 0) {
      const groups = new Map<string, string[]>();
      idResults.forEach((prod: any) => {
        const merchant = prod.merchant || 'Unknown';
        const list = groups.get(merchant) || [];
        list.push(prod.id);
        groups.set(merchant, list);
      });

      const interleavedIds: string[] = [];
      const maxLen = Math.max(...Array.from(groups.values()).map(a => a.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const [merchant, ids] of groups.entries()) {
          if (i < ids.length) {
            interleavedIds.push(ids[i]);
          }
        }
      }

      const skip = (p - 1) * l;
      const pageIds = interleavedIds.slice(skip, skip + l);

      if (pageIds.length === 0 && total > skip) {
        this.logger.warn(`[getAllProducts] pageIds is empty but total is ${total} and skip is ${skip}. Falling back to standard pagination.`);
        const fetchedProducts = await (this.prisma.product as any).findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: l,
          select: this.productListSelect,
        });
        data = fetchedProducts;
      } else {
        const fetchedProducts = await (this.prisma.product as any).findMany({
          where: { id: { in: pageIds } },
          select: this.productListSelect,
        });

        // Sort back to match interleaved order
        data = pageIds.map(id => fetchedProducts.find((prod: any) => prod.id === id)).filter(Boolean);
      }
    }

    // FALLBACK: If 0 products found for the specific category/hierarchy,
    // try a broader search using individual words from the category name.
    // Skip fallback if filters are present so we don't return unrelated products!
    if (total === 0 && category && category !== 'all-products' && !hasFilters) {
      console.log(`[getAllProducts] No products found for "${category}". Trying parent fallback...`);

      const { data: allCats, categoryMap } = await this.categoryService.getCategoryStructure();
      if (allCats && categoryMap) {
        // Match on name as well as slug. The frontend sends the category NAME,
        // so a slug-only lookup never resolved "Single Fabric Beds", which sent
        // it to the keyword fallback below and returned 1,931 fabric sofas.
        const needle = category.trim().toLowerCase();
        const target = allCats.find(
          c => c.slug.toLowerCase() === needle || (c.name || '').toLowerCase() === needle,
        );
        if (target && target.parentId) {
          const parent = categoryMap.get(target.parentId);
          if (parent) {
            console.log(`[getAllProducts] Falling back to parent category: ${parent.name}`);

            // Reuse the same display filters and type exclusions as a normal
            // search. The old fallback queried on the parent name alone, so it
            // bypassed the image requirement, the artificial/merchant
            // exclusions, the colour-variant dedup and every category type
            // rule — which is how sofas kept surfacing under bed pages.
            const parentTerms = this.getCategoryTerms(parent.name);
            const fallbackWhere: any = {
              imageUrl: { not: null },
              NOT: { imageUrl: '' },
              AND: [
                { NOT: { OR: ARTIFICIAL_TERMS.map(t => ({ name: { contains: t, mode: 'insensitive' as const } })) } },
                { OR: [{ colourVariantNumber: 1 }, { colourVariantNumber: null }] },
                { NOT: { OR: EXCLUDED_MERCHANTS.map(m => ({ merchant: { contains: m, mode: 'insensitive' as const } })) } },
                {
                  OR: parentTerms.flatMap(term => [
                    { category: { contains: term, mode: 'insensitive' as const } },
                    { merchantCategory: { contains: term, mode: 'insensitive' as const } },
                  ]),
                },
              ],
            };

            const parentExclusions = this.getExcludedTypesFor(
              parent.name,
              [parent],
              categoryMap,
            );
            if (parentExclusions?.length) {
              fallbackWhere.AND.push({
                OR: [
                  { productTypeClean: null },
                  { productTypeClean: { notIn: parentExclusions } },
                ],
              });
            }

            const [fallbackData, fallbackTotal] = await Promise.all([
              (this.prisma.product as any).findMany({
                where: fallbackWhere,
                skip,
                take: l,
                orderBy: { createdAt: 'desc' },
                select: this.productListSelect,
              }),
              (this.prisma.product as any).count({ where: fallbackWhere }),
            ]);
            return { data: fallbackData.map((prod: any) => this.enhanceProductImages(prod)), meta: { total: fallbackTotal, page: p, limit: l, totalPages: Math.ceil(fallbackTotal / l) } };
          }
        }
      }

      // The keyword fallback that used to sit here split the category name on
      // whitespace and matched ANY word longer than two characters, with none
      // of the display filters applied. "Single Fabric Beds" became
      // category contains 'single' OR 'fabric' OR 'beds' and returned 1,931
      // products — mostly fabric sofas and recliners — on a bed page.
      //
      // A category with no products and no parent now simply returns empty,
      // which is honest. The parent fallback above covers the real case.
      console.log(`[getAllProducts] No parent for "${category}" — returning empty.`);
    }

    const products = data.map((p: any) => this.enhanceProductImages(p));

    const result = {
      data: products,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l),
      },
    };

    // Evict oldest entries if cache is full
    if (this.productsCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.productsCache.keys().next().value;
      if (oldestKey) this.productsCache.delete(oldestKey);
    }

    this.productsCache.set(cacheKey, { data: result, timestamp: now });

    // Clear cache if requested (or on every request for debugging - but let's just use a short TTL)
    // this.productsCache.clear(); 

    // Periodically cleanup expired entries (roughly 1 in 10 requests)
    if (Math.random() < 0.1) {
      for (const [key, value] of this.productsCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.productsCache.delete(key);
        }
      }
    }

    return result;
  }

  @Get('merchants')
  @ApiOperation({ summary: 'Get all unique merchants from products' })
  async getMerchants() {
    const merchants = await this.prisma.product.findMany({
      distinct: ['merchant'],
      select: { merchant: true },
    });
    return merchants
      .map(m => m.merchant)
      .filter(Boolean)
      .sort((a, b) => a!.localeCompare(b!));
  }

  @Get('brands')
  @ApiOperation({ summary: 'Get all unique brands from products' })
  async getBrands(@Query('category') category?: string) {
    const where: any = {};
    if (category && category !== 'all-products') {
      where.category = { equals: category, mode: 'insensitive' };
    }
    const brands = await this.prisma.product.findMany({
      where,
      distinct: ['merchant'],
      select: { merchant: true },
    });
    return brands
      .map(b => b.merchant)
      .filter(Boolean)
      .sort((a, b) => a!.localeCompare(b!));
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all unique product categories with products' })
  async getCategories() {
    const { data: allCategories, categoryMap, childrenMap } = await this.categoryService.getCategoryStructure();

    const counts = await (this.prisma.product as any).groupBy({
      by: ['category'],
      _count: { _all: true }
    });

    const countMap: Record<string, number> = {};
    (counts as any[]).forEach(c => {
      if (c.category) {
        countMap[c.category] = c._count._all;
      }
    });

    const memo = new Map<string, number>();

    const getDeepCount = (catId: string, visited = new Set<string>()): number => {
      if (visited.has(catId)) return 0;
      if (memo.has(catId)) return memo.get(catId)!;
      visited.add(catId);

      const cat = categoryMap.get(catId);
      if (!cat) return 0;

      const children = childrenMap.get(catId) || [];
      let total = 0;

      if (children.length > 0) {
        // Parent Count = SUM of children only
        children.forEach((child: any) => {
          total += getDeepCount(child.id, visited);
        });
      } else {
        // No children = use own count
        total = countMap[catId] || 0;
      }

      memo.set(catId, total);
      return total;
    };

    // Pre-calculate ALL counts in one go before building hierarchy
    allCategories.forEach(cat => {
      if (!memo.has(cat.id)) {
        getDeepCount(cat.id);
      }
    });

    const buildHierarchy = (cat: any, visited = new Set<string>()) => {
      if (visited.has(cat.id)) return null;
      visited.add(cat.id);

      const children = childrenMap.get(cat.id) || [];
      return {
        ...cat,
        productCount: getDeepCount(cat.id),
        children: children
          .map((child) => buildHierarchy(child, visited))
          .filter(Boolean),
      };
    };

    const EXCLUDED_CATEGORIES = [
      'pet',
      'skin',
      'beauty',
      'health',
      'fragrance',
      'jewelry',
    ];

    const roots = allCategories.filter((c: any) => !c.parentId);
    const filteredRoots = roots
      .map((root: any) => {
        const name = (root.name || '').toLowerCase();
        if (EXCLUDED_CATEGORIES.some((ex) => name.includes(ex))) return null;

        // Always show manual (user-created) categories, even with 0 products
        if (!root.isAwin) {
          return buildHierarchy(root);
        }

        // For Awin-sourced root categories, only show if they have products
        const totalCount = getDeepCount(root.id);
        if (totalCount > 0) {
          return buildHierarchy(root);
        }
        return null;
      })
      .filter(Boolean);

    return filteredRoots;
  }

  @Get('products/by-slug/:slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  @ApiResponse({ status: 200, description: 'Return the product.' })
  async getProductBySlug(@Param('slug') slug: string) {
    // Extract ID from the end of the slug (e.g. -41778241000)
    const idMatch = slug.match(/-(\d+)$/);
    const productId = idMatch ? idMatch[1] : null;

    const product = await (this.prisma.product as any).findFirst({
      where: {
        OR: [
          { slug: { equals: slug, mode: 'insensitive' as const } },
          productId ? { id: productId } : undefined,
        ].filter(Boolean)
      },
      select: this.productListSelect,
    });
    return this.enhanceProductImages(product);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Return the product.' })
  async getProductById(@Param('id') id: string) {
    const product = await (this.prisma.product as any).findUnique({
      where: { id },
      select: this.productListSelect,
    });
    return this.enhanceProductImages(product);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'The product has been successfully updated.' })
  async updateProduct(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'The product has been successfully deleted.' })
  async deleteProduct(@Param('id') id: string) {
    await this.prisma.productColorVariant.deleteMany({ where: { productId: id } });
    const result = await this.prisma.product.delete({ where: { id } });
    this.productsCache.clear();
    this.facetsCache.clear();
    return result;
  }

  @Delete('products/by-merchant/:merchantName')
  @ApiOperation({ summary: 'Delete all products from a specific merchant (Hard Delete)' })
  @ApiResponse({ status: 200, description: 'All products from the merchant have been permanently removed.' })
  async deleteProductsByMerchant(@Param('merchantName') merchantName: string) {
    const products = await this.prisma.product.findMany({
      where: { merchant: { equals: merchantName, mode: 'insensitive' } },
      select: { id: true }
    });
    const productIds = products.map(p => p.id);

    if (productIds.length > 0) {
      await this.prisma.productColorVariant.deleteMany({
        where: { productId: { in: productIds } }
      });
    }

    const result = await this.prisma.product.deleteMany({
      where: { id: { in: productIds } }
    });
    
    this.productsCache.clear();
    this.facetsCache.clear();
    return result;
  }
  @Post('products/bulk-delete')
  @ApiOperation({ summary: 'Bulk delete products by category and/or name/description pattern' })
  async bulkDeleteByFilter(
    @Body() body: { category?: string; namePattern?: string; descriptionPattern?: string },
  ) {
    const where: any = {};

    if (body.category) {
      where.OR = [
        { category: { contains: body.category, mode: 'insensitive' } },
        { merchantCategory: { contains: body.category, mode: 'insensitive' } },
      ];
    }

    if (body.namePattern || body.descriptionPattern) {
      const patternConditions: any[] = [];
      if (body.namePattern) {
        patternConditions.push({ name: { contains: body.namePattern, mode: 'insensitive' } });
      }
      if (body.descriptionPattern) {
        patternConditions.push({ description: { contains: body.descriptionPattern, mode: 'insensitive' } });
      }
      const patternOr = { OR: patternConditions };

      where.AND = where.AND || [];
      where.AND.push(patternOr);
    }

    const products = await this.prisma.product.findMany({ where, select: { id: true } });
    const ids = products.map((p) => p.id);

    if (ids.length > 0) {
      await this.prisma.productColorVariant.deleteMany({ where: { productId: { in: ids } } });
      await this.prisma.product.deleteMany({ where: { id: { in: ids } } });
    }

    this.productsCache.clear();
    this.facetsCache.clear();
    return { deleted: ids.length };
  }

  @Post('products/deduplicate')
  @ApiOperation({ summary: 'Run global product deduplication' })
  async deduplicate() {
    const result = await this.awinService.deduplicateProducts();
    this.productsCache.clear();
    this.facetsCache.clear();
    return result;
  }

  // Curated homepage grid — ported from `main` so the deployed backend serves what the frontend
  // (getHomepageSelectedProducts) calls. Additive; read-only GET reuses enhanceProductImages.
  @Get('homepage-products')
  @ApiOperation({ summary: 'Get all products selected for homepage' })
  async getHomepageProducts() {
    const products = await this.awinService.getHomepageProducts();
    return products.map((p: any) => this.enhanceProductImages(p));
  }

  @Post('homepage-products/:productId')
  @ApiOperation({ summary: 'Add a product to homepage' })
  async addHomepageProduct(@Param('productId') productId: string) {
    return this.awinService.addHomepageProduct(productId);
  }

  @Delete('homepage-products/:productId')
  @ApiOperation({ summary: 'Remove a product from homepage' })
  async removeHomepageProduct(@Param('productId') productId: string) {
    return this.awinService.removeHomepageProduct(productId);
  }

}
