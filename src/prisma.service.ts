import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('DATABASE_URL');
    const logOptions = ['query', 'info', 'warn', 'error'] as const;
    
    if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.');
    }

    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    super({ adapter, log: logOptions as any });

    this.logger = new Logger(PrismaService.name);
    this.logger.log('PrismaClient initialized with PostgreSQL adapter.');
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

