import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const product = await prisma.product.findFirst({
    where: {
      name: { contains: 'ZEPHRA MODERN DINING', mode: 'insensitive' }
    }
  });

  console.log('Product:', product);

  const product2 = await prisma.product.findFirst({
    where: {
      name: { contains: 'MALMO TAN SWIVEL DINING', mode: 'insensitive' }
    }
  });

  console.log('Product2:', product2);

  await app.close();
}

bootstrap().catch(console.error);
