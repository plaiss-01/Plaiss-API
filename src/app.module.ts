import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AwinModule } from './awin/awin.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AwinModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
