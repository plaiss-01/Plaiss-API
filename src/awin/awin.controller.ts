import { Controller, Post, Body, Get, Patch, Delete, Param } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get all saved products' })
  @ApiResponse({ status: 200, description: 'Return all products.' })
  async getAllProducts() {
    return this.prisma.product.findMany();
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
