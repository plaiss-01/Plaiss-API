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
  private readonly CACHE_TTL = 60000; // 1 minute

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
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 50000;
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
    if (category && category !== 'all-products') {
      let categoryNames = [category];

      // 1. Try to find the category in the database first (more permissive search)
      const currentCat = await this.prisma.category.findFirst({
        where: {
          OR: [
            { name: { contains: category, mode: 'insensitive' } },
            { slug: { contains: category, mode: 'insensitive' } }
          ]
        },
      });

      if (currentCat) {
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

        const getDescendantNames = (catId: string, visited = new Set<string>()): string[] => {
          if (visited.has(catId)) return [];
          visited.add(catId);
          const cat = categoryMap.get(catId);
          if (!cat) return [];
          const names = [cat.name];
          const children = childrenMap.get(catId) || [];
          return names.concat(...children.map(child => getDescendantNames(child.id, visited)));
        };

        categoryNames = getDescendantNames(currentCat.id);
      }

      // 2. Merge with subcategories passed from frontend (primary source of truth)
      if (subs) {
        const subArray = subs.split(',').map(s => s.trim());
        categoryNames = Array.from(new Set([...categoryNames, ...subArray]));
      }

      // 3. Search across multiple fields for all discovered names
      const keywords = new Set<string>();
      const EXCLUDED = new Set(['and', 'or', 'of', 'for', 'with', 'the', 'a', '&', 'in', 'on', 'at']);
      
      categoryNames.forEach(name => {
        keywords.add(name);
        // Split by common delimiters but keep the original name too
        const parts = name.split(/[\s&]| and | or /).map(p => p.trim()).filter(p => p.length > 2 && !EXCLUDED.has(p.toLowerCase()));
        parts.forEach(p => keywords.add(p));
      });

      where.OR = Array.from(keywords).flatMap(name => [
        { category: { contains: name, mode: 'insensitive' } },
        { merchantCategory: { contains: name, mode: 'insensitive' } },
        { merchantProductCategoryPath: { contains: name, mode: 'insensitive' } }
      ]);
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
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
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const products = data.map((p: any) => {
      const img = p.imageUrl || p.largeImage || p.awThumbUrl || '';
      return {
        ...p,
        imageUrl: img,
        // Ensure frontend gets 'image' or 'images' if it expects them
        image: img,
        images: img ? [img] : [],
        colors: p.colour ? [{ name: p.colour, hex: p.colour }] : [],
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

    this.productsCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all unique product categories with products' })
  async getCategories() {
    const allCategories = await this.categoryService.findAll();

    // 2. Create optimized lookup maps
    const categoryMap = new Map<string, any>();
    const childrenMap = new Map<string, any[]>();
    allCategories.forEach(cat => {
      categoryMap.set(cat.id, cat);
      if (cat.parentId) {
        const children = childrenMap.get(cat.parentId) || [];
        children.push(cat);
        childrenMap.set(cat.parentId, children);
      }
    });

    const counts = await this.prisma.product.groupBy({
      by: ['category'],
      _count: { _all: true }
    });

    const countMap: Record<string, number> = {};
    counts.forEach(c => {
      if (c.category) {
        countMap[c.category.toLowerCase().trim()] = c._count._all;
      }
    });

    const memo = new Map<string, number>();
    const getDeepCount = (catId: string, visited = new Set<string>()): number => {
      if (visited.has(catId)) return 0;
      if (memo.has(catId)) return memo.get(catId)!;
      visited.add(catId);

      const cat = categoryMap.get(catId);
      if (!cat) return 0;
      const catName = cat.name.toLowerCase().trim();
      let total = countMap[catName] || 0;

      const children = childrenMap.get(catId) || [];
      children.forEach((child: any) => {
        total += getDeepCount(child.id, visited);
      });

      memo.set(catId, total);
      return total;
    };

    const EXCLUDED_CATEGORIES = ['pet', 'skin', 'beauty', 'health', 'fragrance', 'jewelry'];

    const roots = allCategories.filter((c: any) => !c.parentId);
    const filteredRoots = roots.map((root: any) => {
      const name = (root.name || '').toLowerCase();
      if (EXCLUDED_CATEGORIES.some(ex => name.includes(ex))) return null;

      const totalCount = getDeepCount(root.id);
      if (totalCount > 0) {
        const children = childrenMap.get(root.id) || [];
        return {
          ...root,
          productCount: totalCount,
          children: children.map(child => ({
            ...child,
            productCount: getDeepCount(child.id)
          }))
        };
      }
      return null;
    }).filter(Boolean);

    return filteredRoots;
  }

  @Get('products/by-slug/:slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  @ApiResponse({ status: 200, description: 'Return the product.' })
  async getProductBySlug(@Param('slug') slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' }
      }
    });
    return product;
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Return the product.' })
  async getProductById(@Param('id') id: string) {
    return this.prisma.product.findUnique({ where: { id } });
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
    return this.prisma.product.delete({ where: { id } });
  }
}
