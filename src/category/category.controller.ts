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
  findAll(
    @Query('isAwin') isAwin?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string
  ) {
    const isAwinBool = isAwin === 'true' ? true : isAwin === 'false' ? false : undefined;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    return this.categoryService.findAll(isAwinBool, search, limitNum);
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

  @Patch('force-update/:id')
  async forceUpdate(
    @Param('id') id: string,
    @Body() data: any
  ) {
    return this.categoryService.update(id, data);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: any
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
