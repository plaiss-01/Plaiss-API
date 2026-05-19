import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const products = await prisma.product.findMany({
    where: {
      merchant: { in: ['Debenhams UK', 'Cheap Furniture Warehouse', 'Furniture in Fashion'] },
      OR: [
        { category: { contains: 'lighting', mode: 'insensitive' } },
        { merchantCategory: { contains: 'lighting', mode: 'insensitive' } }
      ]
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

  console.log('Matching products for "lighting" string:');
  console.table(products);

  await app.close();
}

bootstrap().catch(console.error);
