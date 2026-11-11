import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { TripStatus } from '../../generated/prisma/client';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MetricsService {
  readonly register = new Registry();
  readonly httpRequests: Counter;
  readonly httpDuration: Histogram;
  readonly tripsInProgress: Gauge;
  readonly queueWaiting: Gauge;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
  ) {
    collectDefaultMetrics({ register: this.register });
    this.httpRequests = new Counter({
      name: 'beroya_http_requests_total',
      help: 'HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register],
    });
    this.httpDuration = new Histogram({
      name: 'beroya_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
      registers: [this.register],
    });
    this.tripsInProgress = new Gauge({
      name: 'beroya_trips_in_progress',
      help: 'Trips currently in progress',
      registers: [this.register],
    });
    this.queueWaiting = new Gauge({
      name: 'beroya_queue_waiting',
      help: 'Waiting jobs per queue',
      labelNames: ['queue'],
      registers: [this.register],
    });
  }

  observeHttp(method: string, route: string, status: number, seconds: number) {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  async render(): Promise<string> {
    const [active, waiting] = await Promise.all([
      this.prisma.shuttleTrip.count({
        where: { status: TripStatus.IN_PROGRESS },
      }),
      this.queues.waitingCounts(),
    ]);
    this.tripsInProgress.set(active);
    for (const [queue, count] of Object.entries(waiting)) {
      this.queueWaiting.set({ queue }, count);
    }
    return this.register.metrics();
  }
}
