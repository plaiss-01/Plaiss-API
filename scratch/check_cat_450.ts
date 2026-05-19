import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const cat = await prisma.category.findUnique({
    where: { id: '450' }
  });

  console.log('Category 450:', cat);

  const parent = cat?.parentId ? await prisma.category.findUnique({ where: { id: cat.parentId } }) : null;
  console.log('Parent of 450:', parent);

  await app.close();
}

bootstrap().catch(console.error);
