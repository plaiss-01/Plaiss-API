import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AwinModule } from './awin/awin.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AwinModule, 
    UsersModule,
    UploadModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
