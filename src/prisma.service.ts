import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    const logOptions = ['query', 'info', 'warn', 'error'] as const;
    
    if (url?.startsWith('postgresql://')) {
      const pool = new Pool({ connectionString: url });
      const adapter = new PrismaPg(pool);
      super({ adapter, log: logOptions as any });
    } else {
      // For SQLite, ensure we use an absolute path for the file
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
  }


  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
