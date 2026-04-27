import { Module } from '@nestjs/common';
import { VisualSearchController } from './visual-search.controller';
import { VisualSearchService } from './visual-search.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VisualSearchController],
  providers: [VisualSearchService],
  exports: [VisualSearchService],
})
export class VisualSearchModule {}
