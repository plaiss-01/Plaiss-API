import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const product = await prisma.product.findFirst({
    where: {
      name: { contains: 'SERENE RATTAN SMALL SIDE', mode: 'insensitive' }
    }
  });

  console.log('Product:', product);

  await app.close();
}

bootstrap().catch(console.error);
