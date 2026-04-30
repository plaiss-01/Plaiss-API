import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CategoryService } from './category.service';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Post()
  create(@Body() data: { name: string; parentId?: string; isAwin?: boolean }) {
    return this.categoryService.create(data);
  }

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get('roots')
  findRoots() {
    return this.categoryService.findRoots();
  }


  @Post('reorder')
  reorder(@Body() orders: { id: string; order: number }[]) {
    return this.categoryService.reorder(orders);
  }

  @Post('sync-awin')
  syncAwin() {
    return this.categoryService.syncAwinCategories();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch('bulk-link')
  bulkLink(@Body() data: { ids: string[]; parentId: string }) {
    return this.categoryService.bulkLink(data.ids, data.parentId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; parentId?: string | null }
  ) {
    return this.categoryService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }

  @Delete()
  removeAll() {
    return this.categoryService.removeAll();
  }
}
