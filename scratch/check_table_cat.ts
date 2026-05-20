import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { CategoryService } from '../src/category/category.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const categoryService = app.get(CategoryService);

  const { data: allCats } = await categoryService.getCategoryStructure();

  const tableCats = allCats.filter(c => c.slug === 'table' || c.name.toLowerCase() === 'table');
  console.log('Categories matching "table":', tableCats);

  await app.close();
}

bootstrap().catch(console.error);
