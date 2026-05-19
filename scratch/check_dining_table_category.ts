import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const products = await prisma.product.findMany({
    where: {
      merchant: 'Furniture in Fashion',
      category: { contains: 'Table', mode: 'insensitive' }
    },
    select: {
      name: true,
      category: true,
      merchantCategory: true,
      categoryId: true,
      merchant: true
    },
    take: 10
  });

  console.log('Sample Furniture in Fashion Table products:');
  console.table(products);

  await app.close();
}

bootstrap().catch(console.error);
