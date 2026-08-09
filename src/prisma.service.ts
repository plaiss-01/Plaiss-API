import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  readonly pool: Pool;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('DATABASE_URL');
    // 'query' deliberately excluded: it wrote every full SQL statement to
    // stdout, which Container Apps ships to Log Analytics at per-GB rates -
    // pure noise with a monthly bill attached. Approved by Raphael 2026-08-09.
    const logOptions = ['info', 'warn', 'error'] as const;

    if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.');
    }

    const pool = new Pool({
      connectionString: url,
      max: 15,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 60000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter, log: logOptions as any });

    this.logger = new Logger(PrismaService.name);
    this.pool = pool;
    this.logger.log('PrismaClient initialized with PostgreSQL adapter.');
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
