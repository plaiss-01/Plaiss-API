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
  ) {}

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
    @Query('limit') limit: string = '10',
    @Query('category') category?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const skip = (p - 1) * l;

    const where: any = {};
    if (category && category !== 'all-products') {
      where.category = {
        contains: category,
        mode: 'insensitive',
      };
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
          merchant: true,
          productUrl: true,
          description: true,
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
  @ApiOperation({ summary: 'Get all unique product categories' })
  async getCategories() {
    const categories = await this.prisma.product.groupBy({
      by: ['category'],
    });
    
    // Normalize to lowercase and remove duplicates
    const uniqueSlugs = new Set(
      categories
        .map(c => c.category?.toLowerCase().trim())
        .filter(Boolean)
    );

    return Array.from(uniqueSlugs).map(slug => ({
      slug,
    }));
  }

  @Get('products/by-slug/:slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  @ApiResponse({ status: 200, description: 'Return the product.' })
  async getProductBySlug(@Param('slug') slug: string) {
    // Note: In a real app, you'd store the slug in the DB. 
    // Here we find it by name comparison since we don't have a slug field yet.
    const all = await this.prisma.product.findMany();
    return all.find(p => p.name.toLowerCase().replace(/ /g, '-') === slug.toLowerCase());
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
