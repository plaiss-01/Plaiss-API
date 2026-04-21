import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AwinService } from './awin.service';
import { AwinController } from './awin.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [AwinController],
  providers: [AwinService, PrismaService],
})
export class AwinModule {}
