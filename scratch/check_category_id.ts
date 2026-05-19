import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const countMapped = await prisma.product.count({
    where: { categoryId: { not: null } }
  });
  const countUnmapped = await prisma.product.count({
    where: { categoryId: null }
  });

  console.log(`Mapped products: ${countMapped}`);
  console.log(`Unmapped products: ${countUnmapped}`);

  await app.close();
}

bootstrap().catch(console.error);
