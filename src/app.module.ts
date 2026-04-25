import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AwinModule } from './awin/awin.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './upload/upload.module';
import { CategoryModule } from './category/category.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AwinModule, 
    UsersModule,
    UploadModule,
    CategoryModule
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
