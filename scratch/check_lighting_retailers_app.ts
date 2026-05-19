import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const categories = await prisma.category.findMany({
    where: {
      name: {
        contains: 'lighting',
        mode: 'insensitive',
      }
    }
  });

  console.log("Categories matching 'lighting':", categories.map(c => c.name));

  for (const cat of categories) {
    const products = await prisma.product.groupBy({
      by: ['merchant'],
      where: {
        category: cat.name
      },
      _count: {
        id: true
      }
    });
    console.log(`\nRetailers for category '${cat.name}':`);
    console.table(products.map(p => ({ Merchant: p.merchant, Count: p._count.id })));
  }

  await app.close();
}

bootstrap().catch(console.error);
