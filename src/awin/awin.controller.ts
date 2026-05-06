import { Controller, Post, Body, Get, Patch, Delete, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
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
export class AwinController {
  constructor(
    private readonly awinService: AwinService,
    private readonly prisma: PrismaService,
    private readonly statusService: ImportStatusService,
    private readonly categoryService: CategoryService,
  ) { }

  private productsCache = new Map<string, { data: any, timestamp: number }>();
  private categoriesCache: { 
    data: any[], 
    categoryMap: Map<string, any>, 
    childrenMap: Map<string, any[]>,
    timestamp: number 
  } | null = null;
  private readonly CACHE_TTL = 300000; // 5 minutes for category structure
  private readonly MAX_CACHE_SIZE = 20; // Maximum number of cached queries

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

  @Get('products')
  @ApiOperation({ summary: 'Get all saved products with pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated products.' })
  async getAllProducts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('category') category?: string,
    @Query('subs') subs?: string,
    @Query('search') search?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    let l = parseInt(limit, 10) || 50;
    if (l > 1000) l = 1000; // Cap limit to prevent memory issues
    const skip = (p - 1) * l;

    const cacheKey = `products-${p}-${l}-${category || 'all'}`;
    const now = Date.now();
    if (this.productsCache.has(cacheKey)) {
      const cached = this.productsCache.get(cacheKey)!;
      if (now - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    } else if (category && category !== 'all-products') {
      const now = Date.now();
      if (!this.categoriesCache || now - this.categoriesCache.timestamp > this.CACHE_TTL) {
        const allCats = await this.categoryService.findAll();
        const categoryMap = new Map<string, any>();
        const childrenMap = new Map<string, any[]>();
        allCats.forEach(cat => {
          categoryMap.set(cat.id, cat);
          if (cat.parentId) {
            const children = childrenMap.get(cat.parentId) || [];
            children.push(cat);
            childrenMap.set(cat.parentId, children);
          }
        });
        this.categoriesCache = { data: allCats, categoryMap, childrenMap, timestamp: now };
      }
      
      const { data: allCats, categoryMap, childrenMap } = this.categoriesCache;

      // Find the requested categories
      const targetCats = allCats.filter(c => 
        c.slug.toLowerCase() === category.toLowerCase() ||
        c.name.toLowerCase() === category.toLowerCase()
      );

      console.log(`[getAllProducts] Query: "${category}", Found ${targetCats.length} target categories.`);

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
            
            descendantIds.forEach(id => {
              const c = categoryMap.get(id);
              if (c) {
                allCategoryNames.push(c.name);
                allCategoryNames.push(c.name.toLowerCase().trim());
              }
            });
          }
        } else {
          // If category has NO children, use its own ID and Name
          allCategoryIds.push(cat.id);
          allCategoryNames.push(cat.name);
          allCategoryNames.push(cat.name.toLowerCase().trim());
        }
      }

      if (subs) {
        const subArray = subs.split(',').map(s => s.replace(/\+/g, ' ').trim());
        allCategoryNames.push(...subArray);
        
        // Also try to find IDs for these sub names
        const subCats = allCats.filter(c => subArray.some(s => s.toLowerCase() === c.name.toLowerCase()));
        allCategoryIds.push(...subCats.map(c => c.id));
      }

      let uniqueIds = Array.from(new Set(allCategoryIds));
      let uniqueNames = Array.from(new Set(allCategoryNames));

      // FALLBACK LOGIC: If we found target categories but they have 0 products (check via pre-calculated count if possible, or just prepare OR)
      // Actually, it's better to do this after the query if total is 0. 
      // But we can also proactively add parents if the user wants "combination... if not available then use main".
      
      // Let's stick to the current plan: 
      // 1. Unique IDs/Names from the target and its descendants.
      // 2. If the query returns 0, we will check parents in the fallback section.

      
      console.log(`[getAllProducts] Query: "${category}", IDs: ${uniqueIds.length}, Names: ${uniqueNames.length}`);

      where.OR = [
        { internalCategoryId: { in: uniqueIds } },
        { category: { in: uniqueNames, mode: 'insensitive' } },
        { merchantCategory: { in: uniqueNames, mode: 'insensitive' } },
      ];
    }

    let [data, total] = await Promise.all([
      (this.prisma.product as any).findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          awThumbUrl: true,
          largeImage: true,
          category: true,
          slug: true,
          merchant: true,
          productUrl: true,
          description: true,
          createdAt: true,
          colour: true,
          merchantCategory: true,
          productType: true,
          colorVariants: true,
          attributes: {
            select: {
              attribute: { select: { name: true } },
              attributeValue: { select: { value: true } }
            }
          }
        },
      }),
      (this.prisma.product as any).count({ where }),
    ]);

    // FALLBACK: If 0 products found for the specific category/hierarchy,
    // try a broader search using individual words from the category name.
    if (total === 0 && category && category !== 'all-products') {
      console.log(`[getAllProducts] No products found for "${category}". Trying parent fallback...`);
      
      const { data: allCats, categoryMap } = this.categoriesCache || {};
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
                     { internalCategoryId: parent.id },
                     { category: { contains: parent.name, mode: 'insensitive' } }
                   ]
                 },
                 skip,
                 take: l,
                 orderBy: { createdAt: 'desc' },
                 select: {
                   id: true,
                   name: true,
                   price: true,
                   imageUrl: true,
                   awThumbUrl: true,
                   largeImage: true,
                   category: true,
                   slug: true,
                   merchant: true,
                   productUrl: true,
                   description: true,
                   createdAt: true,
                   colour: true,
                   merchantCategory: true,
                   productType: true,
                   colorVariants: true,
                   attributes: {
                     select: {
                       attribute: { select: { name: true } },
                       attributeValue: { select: { value: true } }
                     }
                   }
                 },
               }),
               (this.prisma.product as any).count({
                 where: {
                   OR: [
                     { internalCategoryId: parent.id },
                     { category: { contains: parent.name, mode: 'insensitive' } }
                   ]
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
            { merchantCategory: { contains: word, mode: 'insensitive' } },
            { merchantProductCategoryPath: { contains: word, mode: 'insensitive' } }
          ])
        };

        const [fallbackData, fallbackTotal] = await Promise.all([
          (this.prisma.product as any).findMany({
            where: fallbackWhere,
            skip,
            take: l,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              awThumbUrl: true,
              largeImage: true,
              category: true,
              slug: true,
              merchant: true,
              productUrl: true,
              description: true,
              createdAt: true,
              colour: true,
              merchantCategory: true,
              productType: true,
              colorVariants: true,
              attributes: {
                select: {
                  attribute: { select: { name: true } },
                  attributeValue: { select: { value: true } }
                }
              }
            },
          }),
          (this.prisma.product as any).count({ where: fallbackWhere }),
        ]);

        if (fallbackTotal > 0) {
          data = fallbackData;
          total = fallbackTotal;
        }
      }
    }

    const products = data.map((p: any) => {
      const img = p.imageUrl || p.largeImage || p.awThumbUrl || '';
      return {
        ...p,
        imageUrl: img,
        // Ensure frontend gets 'image' or 'images' if it expects them
        image: img,
        images: img ? [img] : [],
        colors: [
          ...(p.colour ? [{ name: p.colour, hex: p.colour, imageUrl: img, productUrl: p.productUrl }] : []),
          ...(p.colorVariants || []).map((v: any) => ({
            name: v.colorName,
            hex: v.colorName,
            imageUrl: v.imageUrl,
            productUrl: v.productUrl
          }))
        ],
        // Flatten attributes for easier frontend consumption
        normalizedAttributes: (p.attributes || []).reduce((acc: any, attr: any) => {
          acc[attr.attribute.name] = attr.attributeValue.value;
          return acc;
        }, {}),
      };
    });

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

  @Get('categories')
  @ApiOperation({ summary: 'Get all unique product categories with products' })
  async getCategories() {
    const now = Date.now();
    if (!this.categoriesCache || now - this.categoriesCache.timestamp > this.CACHE_TTL) {
      const allCats = await this.categoryService.findAll();
      const categoryMap = new Map<string, any>();
      const childrenMap = new Map<string, any[]>();
      allCats.forEach(cat => {
        categoryMap.set(cat.id, cat);
        if (cat.parentId) {
          const children = childrenMap.get(cat.parentId) || [];
          children.push(cat);
          childrenMap.set(cat.parentId, children);
        }
      });
      this.categoriesCache = { data: allCats, categoryMap, childrenMap, timestamp: now };
    }
    const { data: allCategories, categoryMap, childrenMap } = this.categoriesCache;

    const counts = await (this.prisma.product as any).groupBy({
      by: ['internalCategoryId'],
      _count: { _all: true }
    });

    const countMap: Record<string, number> = {};
    (counts as any[]).forEach(c => {
      if (c.internalCategoryId) {
        countMap[c.internalCategoryId] = c._count._all;
      }
    });

    const memo = new Map<string, number>();
    
    // 3. Pre-calculate deep counts iteratively (bottom-up is better, but this single-pass recursive with memo is okay)
    // Actually, let's do a proper iterative pre-calculation for maximum speed
    const calculateAllCounts = () => {
      // Initialize with direct counts using ID
      allCategories.forEach(cat => {
        memo.set(cat.id, countMap[cat.id] || 0);
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
    const product = await (this.prisma.product as any).findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' }
      },
      include: {
        colorVariants: true,
        attributes: {
          include: {
            attribute: true,
            attributeValue: true
          }
        }
      }
    });
    return product;
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Return the product.' })
  async getProductById(@Param('id') id: string) {
    return (this.prisma.product as any).findUnique({ 
      where: { id },
      include: {
        colorVariants: true,
        attributes: {
          include: {
            attribute: true,
            attributeValue: true
          }
        }
      }
    });
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
    const result = await this.prisma.product.delete({ where: { id } });
    this.productsCache.clear(); // Clear cache to reflect deletion
    return result;
  }

  @Delete('products/by-merchant/:merchantName')
  @ApiOperation({ summary: 'Delete all products from a specific merchant (Hard Delete)' })
  @ApiResponse({ status: 200, description: 'All products from the merchant have been permanently removed.' })
  async deleteProductsByMerchant(@Param('merchantName') merchantName: string) {
    const result = await this.prisma.product.deleteMany({
      where: {
        merchant: { equals: merchantName, mode: 'insensitive' }
      }
    });
    this.productsCache.clear(); // Clear cache to reflect deletions
    return result;
  }
  @Post('products/deduplicate')
  @ApiOperation({ summary: 'Run global product deduplication' })
  async deduplicate() {
    const result = await this.awinService.deduplicateProducts();
    this.productsCache.clear();
    return result;
  }
}
