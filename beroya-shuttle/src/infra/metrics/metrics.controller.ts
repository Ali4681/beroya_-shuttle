import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('ops')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Prometheus metrics' })
  async render(@Res() response: Response) {
    const body = await this.metrics.render();
    response
      .status(200)
      .setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(body);
  }
}
