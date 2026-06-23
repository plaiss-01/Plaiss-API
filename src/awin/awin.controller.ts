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
    const categories = ['Plants', 'Sofas', 'Lighting', 'Chairs', 'Decor'];
    this.logger.log('[Warmup] Pre-populating product cache for popular categories...');
    for (const cat of categories) {
      try {
        await this.getAllProducts('1', '24', cat);
        this.logger.log(`[Warmup] Cached: ${cat}`);
      } catch (e) {
        this.logger.warn(`[Warmup] Failed for ${cat}: ${e.message}`);
      }
    }
    this.logger.log('[Warmup] Done.');
  }

  private productsCache = new Map<string, { data: any, timestamp: number }>();
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
      colors: product.colour ? [{ name: product.colour, hex: product.colour, imageUrl: img, productUrl: product.productUrl }] : [],
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
      .then(() => this.productsCache.clear())
      .catch((e) => {
        this.statusService.failJob(jobId, e.message);
      });

    this.productsCache.clear();
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
    const isAllProducts = !category || category.toLowerCase() === 'all-products';
    if (isAllProducts && !subs) {
      const priceAgg = await (this.prisma.product as any).aggregate({
        _min: { discountedPriceClean: true, price: true },
        _max: { discountedPriceClean: true, price: true },
      });
      const minVal = priceAgg._min.discountedPriceClean ?? priceAgg._min.price;
      const maxVal = priceAgg._max.discountedPriceClean ?? priceAgg._max.price;
      return {
        sizes: [], colors: [], materials: [], merchants: [],
        priceMin: Math.floor(minVal ?? 0),
        priceMax: Math.ceil(maxVal ?? 0),
      };
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

    // If no subcategories are requested, include the requested category name/terms
    if (category && !subs) {
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
    }

    const [sizes, colors, materials, merchants] = await Promise.all([
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
    ]);

    // For prices, we can just do a simple findMany and calculate or use aggregate if available
    const priceAgg = await (this.prisma.product as any).aggregate({
      where,
      _min: { discountedPriceClean: true, price: true },
      _max: { discountedPriceClean: true, price: true },
    });
 
    const minPriceVal = priceAgg._min.discountedPriceClean ?? priceAgg._min.price;
    const maxPriceVal = priceAgg._max.discountedPriceClean ?? priceAgg._max.price;

    return {
      sizes: sizes.map((s: any) => s.sizeStockStatusClean).filter(Boolean),
      colors: colors.map((c: any) => c.colourClean).filter(Boolean),
      materials: materials.map((m: any) => m.productModelClean).filter(Boolean),
      merchants: merchants.map((m: any) => m.merchant).filter(Boolean),
      priceMin: minPriceVal ?? 0,
      priceMax: maxPriceVal ?? 0,
    };
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

;

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

      // If no subcategories are requested, include the requested category name/terms
      if (category && !subs) {
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

      // Let's stick to the current plan: 
      // 1. Unique IDs/Names from the target and its descendants.
      // 2. If the query returns 0, we will check parents in the fallback section.


;

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
          OR: array.flatMap(val => [
            { productType: { contains: val, mode: 'insensitive' as const } },
            { category: { contains: val, mode: 'insensitive' as const } }
          ])
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
        const target = allCats.find(c => c.slug.toLowerCase() === category.toLowerCase());
        if (target && target.parentId) {
          const parent = categoryMap.get(target.parentId);
          if (parent) {
            console.log(`[getAllProducts] Falling back to parent category: ${parent.name}`);
            // Re-run search for parent
            const [fallbackData, fallbackTotal] = await Promise.all([
              (this.prisma.product as any).findMany({
                where: {
                  OR: [
                    { category: { contains: parent.name, mode: 'insensitive' } }
                  ]
                },
                skip,
                take: l,
                orderBy: { createdAt: 'desc' },
                select: this.productListSelect,
              }),
              this.prisma.product.count({
                where: {
                  category: { contains: parent.name, mode: 'insensitive' }
                }
              }),
            ]);
            return { data: fallbackData, total: fallbackTotal, page: p, totalPages: Math.ceil(fallbackTotal / l) };
          }
        }
      }

      // If no parent or parent search failed, try keyword fallback
      const words = category.split(/[\s&>|]+/).filter(w => w.length > 2);
      if (words.length > 0) {
        const fallbackWhere: any = {
          OR: words.flatMap(word => [
            { category: { contains: word, mode: 'insensitive' } },
            { merchantCategory: { contains: word, mode: 'insensitive' } }
          ])
        };

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

        if (fallbackTotal > 0) {
          data = fallbackData;
          total = fallbackTotal;
        }
      }
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

    // 3. Pre-calculate deep counts iteratively (bottom-up is better, but this single-pass recursive with memo is okay)
    // Actually, let's do a proper iterative pre-calculation for maximum speed
    const calculateAllCounts = () => {
      // Initialize with direct counts using category name!
      allCategories.forEach(cat => {
        memo.set(cat.id, countMap[cat.name] || 0);
      });

      // Simple way: multiple passes or a topological sort. 
      // But for 40k items, let's use a faster approach: 
      // Group by depth or just build parent-child relations and use a recursive memoized function.
    };

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
    this.productsCache.clear(); // Clear cache to reflect deletion
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
    
    this.productsCache.clear(); // Clear cache to reflect deletions
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
    return { deleted: ids.length };
  }

  @Post('products/deduplicate')
  @ApiOperation({ summary: 'Run global product deduplication' })
  async deduplicate() {
    const result = await this.awinService.deduplicateProducts();
    this.productsCache.clear();
    return result;
  }

}
