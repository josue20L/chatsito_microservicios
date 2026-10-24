import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    this.pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(this.pool);
    this.prisma = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    try {
      await this.prisma.$connect();
    } catch (error) {
      console.error('Error connecting to database:', error);
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    await this.pool.end();
  }

  get usuarios() {
    return this.prisma.usuarios;
  }

  async $queryRaw(query: any, ...values: any[]) {
    return this.prisma.$queryRaw(query, ...values);
  }
}
