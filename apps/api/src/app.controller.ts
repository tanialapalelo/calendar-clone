import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('db-health')
  async dbHealth() {
    const result = await this.prisma.$queryRaw<
      { ok: number }[]
    >`SELECT 1 as ok`;
    return { ok: true, db: result?.[0]?.ok === 1 };
  }
}
