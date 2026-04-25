import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AwinService } from './awin.service';
import { AwinController } from './awin.controller';
import { PrismaService } from '../prisma.service';
import { ImportStatusService } from './import-status.service';

@Module({
  imports: [HttpModule],
  controllers: [AwinController],
  providers: [AwinService, PrismaService, ImportStatusService],
  exports: [AwinService, ImportStatusService],
})
export class AwinModule {}
