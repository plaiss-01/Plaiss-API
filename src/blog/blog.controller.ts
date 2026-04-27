import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { Prisma } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new blog post' })
  create(@Body() data: Prisma.BlogPostCreateInput) {
    return this.blogService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blog posts' })
  findAll() {
    return this.blogService.findAll();
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a blog post by ID or slug' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    try {
      // Try by slug first
      return await this.blogService.findBySlug(idOrSlug);
    } catch (e) {
      // If not found by slug, try by ID
      try {
        return await this.blogService.findOne(idOrSlug);
      } catch (e2) {
        throw new NotFoundException('Blog post not found');
      }
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a blog post' })
  update(@Param('id') id: string, @Body() data: Prisma.BlogPostUpdateInput) {
    return this.blogService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a blog post' })
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
