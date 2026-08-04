import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { AdminKeyGuard } from '../common/admin-key.guard';

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
    @Query('limit') limit?: string,
    @Query('parentId') parentId?: string
  ) {
    const isAwinBool = isAwin === 'true' ? true : isAwin === 'false' ? false : undefined;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    return this.categoryService.findAll(isAwinBool, search, limitNum, parentId);
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

  // Wipes the entire category tree, which the mega menu is built from.
  @Delete()
  @UseGuards(AdminKeyGuard)
  removeAll() {
    return this.categoryService.removeAll();
  }
}
