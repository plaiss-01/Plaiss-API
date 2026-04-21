import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AwinModule } from './awin/awin.module';

@Module({
  imports: [AwinModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
