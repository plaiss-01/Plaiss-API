import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AwinService } from './awin.service';
import { AwinController } from './awin.controller';
import { PrismaService } from '../prisma.service';
import { ImportStatusService } from './import-status.service';

import { CategoryModule } from '../category/category.module';
import { CategoryService } from '../category/category.service';

@Module({
  imports: [HttpModule, CategoryModule],
  controllers: [AwinController],
  providers: [AwinService, ImportStatusService],
  exports: [AwinService, ImportStatusService],
})
export class AwinModule {}
