import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const url = configService.get<string>('DATABASE_URL');
    const logOptions = ['query', 'info', 'warn', 'error'] as const;
    
    if (url?.startsWith('postgresql://') || url?.startsWith('postgres://')) {
      const pool = new Pool({ connectionString: url });
      const adapter = new PrismaPg(pool);
      super({ adapter, log: logOptions as any });
    } else {
      // Fallback to SQLite/LibSQL if URL is not Postgres
      let sqliteUrl = url ?? 'file:./dev.db';
      if (sqliteUrl.startsWith('file:')) {
        const relativePath = sqliteUrl.replace('file:', '');
        const absolutePath = path.resolve(process.cwd(), relativePath);
        sqliteUrl = `file:${absolutePath}`;
      }
      
      const adapter = new PrismaLibSql({
        url: sqliteUrl,
      });
      super({ adapter, log: logOptions as any });
    }

    this.logger.log('PrismaClient initialized.');
  }


  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
