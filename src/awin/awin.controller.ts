import { Controller, Post, Body, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AwinService } from './awin.service';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('awin')
@Controller('awin')
export class AwinController {
  constructor(
    private readonly awinService: AwinService,
    private readonly prisma: PrismaService,
  ) { }

  @Post('add-product')
  @ApiOperation({ summary: 'Add a new product using an Awin URL' })
  @ApiResponse({ status: 201, description: 'The product has been successfully created.' })
  async addProduct(@Body() createProductDto: CreateProductDto) {
    return this.awinService.addProductFromUrl(createProductDto.url);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all saved products with pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated products.' })
  async getAllProducts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '1000',
    @Query('category') category?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 1000;
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
          // Fetch all categories once to build a tree in memory
          const allCats = await (this.prisma as any).category.findMany();
          
          const getDescendantNames = (catId: string): string[] => {
            const cat = allCats.find((c: any) => c.id === catId);
            if (!cat) return [];
            
            let names = [cat.name];
            const children = allCats.filter((c: any) => c.parentId === catId);
            children.forEach((child: any) => {
              names = names.concat(getDescendantNames(child.id));
            });
            return names;
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
    // 1. Get all categories
    const allCategories = await (this.prisma as any).category.findMany({
      include: {
        children: {
          include: {
            children: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // 2. Get product counts from Product table
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

    // 3. Helper to calculate total count for a category and its descendants
    const getDeepCount = (cat: any): number => {
      let total = countMap[cat.name.toLowerCase().trim()] || 0;
      if (cat.children) {
        cat.children.forEach((child: any) => {
          total += getDeepCount(child);
        });
      }
      return total;
    };

    // 4. Filter categories that have at least one product and are not blacklisted
    const EXCLUDED_CATEGORIES = ['pet', 'skin', 'beauty', 'health', 'fragrance', 'jewelry'];

    const roots = allCategories.filter((c: any) => !c.parentId);
    const filteredRoots = roots.map((root: any) => {
      const name = (root.name || '').toLowerCase();
      if (EXCLUDED_CATEGORIES.some(ex => name.includes(ex))) return null;

      const totalCount = getDeepCount(root);
      if (totalCount > 0) {
        return {
          ...root,
          productCount: totalCount
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
