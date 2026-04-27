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
import { BlogModule } from './blog/blog.module';
import { VisualSearchModule } from './visual-search/visual-search.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AwinModule, 
    UsersModule,
    UploadModule,
    CategoryModule,
    BlogModule,
    VisualSearchModule
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
