import { Controller, Post, Body, Get, Patch, Delete, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AwinService } from './awin.service';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportStatusService } from './import-status.service';

@ApiTags('awin')
@Controller('awin')
export class AwinController {
  constructor(
    private readonly awinService: AwinService,
    private readonly prisma: PrismaService,
    private readonly statusService: ImportStatusService,
  ) { }

  private categoriesCache: { data: any[], timestamp: number } | null = null;
  private readonly CATEGORY_CACHE_TTL = 60000; // 1 minute

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
    @Query('limit') limit: string = '5000',
    @Query('category') category?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 5000;
    const skip = (p - 1) * l;

    const where: any = {};
    if (category && category !== 'all-products') {
      // Find the category and all its children to include in the filter
      const currentCat = await (this.prisma as any).category.findFirst({
        where: {
          OR: [
            { name: { equals: category, mode: 'insensitive' } },
            { slug: { equals: category, mode: 'insensitive' } }
          ]
        },
        include: { children: true }
      });

      const ROOM_MAPPINGS: Record<string, string[]> = {
        'Living Room': ['Tables', 'Chairs', 'Storage', 'Decorations', 'Lighting'],
        'Bedroom': ['Beds', 'Mattresses', 'Storage'],
        'Kitchen': ['Kitchen Units', 'Cookware & Utensils'],
        'Outdoor': ['Sheds & Garden Furniture', 'Plants & Seeds'],
        'Garden & Outdoor': ['Sheds & Garden Furniture', 'Plants & Seeds'],
        'Kitchen & Dining': ['Kitchen Units', 'Tables', 'Chairs'],
      };

      if (ROOM_MAPPINGS[category]) {
        where.OR = ROOM_MAPPINGS[category].map(name => ({
          category: { contains: name, mode: 'insensitive' }
        }));
      } else {
        const currentCat = await (this.prisma as any).category.findFirst({
          where: {
            OR: [
              { name: { equals: category, mode: 'insensitive' } },
              { slug: { equals: category, mode: 'insensitive' } }
            ]
          },
        });

        if (currentCat) {
          // Fetch all categories once or use cache
          let allCats: any[];
          const now = Date.now();
          if (this.categoriesCache && (now - this.categoriesCache.timestamp < this.CATEGORY_CACHE_TTL)) {
            allCats = this.categoriesCache.data;
          } else {
            allCats = await (this.prisma as any).category.findMany();
            this.categoriesCache = { data: allCats, timestamp: now };
          }
          
          // Create optimized lookup maps
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

          const categoryNames = getDescendantNames(currentCat.id);
          where.OR = categoryNames.map(name => ({
            category: {
              contains: name,
              mode: 'insensitive'
            }
          }));
        } else {
          where.category = {
            contains: category,
            mode: 'insensitive',
          };
        }
      }
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
          category: true,
          slug: true,
          merchant: true,
          productUrl: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l),
      },
    };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all unique product categories with products' })
  async getCategories() {
    // 1. Get all categories flat
    const allCategories = await (this.prisma as any).category.findMany({
      orderBy: { name: 'asc' }
    });

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

    // 3. Get product counts from Product table
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

    // 4. Memoized deep count calculation
    const memo = new Map<string, number>();
    
    const getDeepCount = (catId: string, visited = new Set<string>()): number => {
      if (visited.has(catId)) return 0;
      if (memo.has(catId)) return memo.get(catId)!;
      visited.add(catId);

      const cat = categoryMap.get(catId);
      if (!cat) return 0;

      let total = countMap[cat.name.toLowerCase().trim()] || 0;
      const children = childrenMap.get(catId) || [];
      children.forEach((child: any) => {
        total += getDeepCount(child.id, visited);
      });
      
      memo.set(catId, total);
      return total;
    };

    // 5. Build root categories with deep counts
    const roots = allCategories.filter((c: any) => !c.parentId);
    const EXCLUDED_CATEGORIES = ['pet', 'skin', 'beauty', 'health', 'fragrance', 'jewelry'];

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
          })).filter(c => c.productCount > 0)
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
    console.log(`[AwinController] Fetching product by slug: ${slug}`);
    const product = await this.prisma.product.findFirst({
      where: { 
        slug: { equals: slug, mode: 'insensitive' }
      }
    });
    console.log(`[AwinController] Found product: ${product ? product.name : 'NULL'}`);
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
