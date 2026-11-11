import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShuttleRole } from '../../generated/prisma/client';
import { JOB_CATALOG } from '../../infra/queue/jobs.catalog';
import { isMockQueueConnection } from '../../infra/queue/queue.constants';
import { QUEUE_CONNECTION } from '../../infra/queue/queue.constants';
import { Inject } from '@nestjs/common';
import type { QueueConnection } from '../../infra/queue/queue.constants';

@ApiTags('ops')
@ApiBearerAuth()
@Roles(ShuttleRole.BEROYA_ADMIN)
@Controller('admin/ops')
export class OpsController {
  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
  ) {}

  @Get('jobs')
  @ApiOperation({ summary: 'Scheduled and event-driven job catalog' })
  jobs() {
    return {
      mockRedis: isMockQueueConnection(this.connection),
      jobs: JOB_CATALOG,
    };
  }
}
