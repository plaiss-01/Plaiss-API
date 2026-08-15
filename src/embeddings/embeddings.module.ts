import { Module } from '@nestjs/common';
import { EmbeddingsController } from './embeddings.controller';
import { EmbeddingsService } from './embeddings.service';

// PrismaService is NOT listed here - PrismaModule is @Global() (see
// src/prisma.module.ts) and already imported once in AppModule. Re-providing
// it here would spin up a second pg Pool.
@Module({
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
