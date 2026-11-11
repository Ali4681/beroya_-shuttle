import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import type { QueueConnection, QueueName } from './queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from './queue.constants';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
  ) {
    if (isMockQueueConnection(this.connection)) {
      return;
    }
    for (const name of Object.values(QUEUE_NAMES)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
  }

  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Unknown queue: ${name}`);
    }
    return queue;
  }

  enqueue<T>(name: QueueName, jobName: string, data: T, opts?: JobsOptions) {
    if (isMockQueueConnection(this.connection)) {
      return Promise.resolve({
        id: `${name}:${jobName}:${Date.now()}`,
        name: jobName,
        data,
        opts,
      });
    }
    return this.getQueue(name).add(jobName, data, opts);
  }

  scheduleRepeatable(
    name: QueueName,
    schedulerId: string,
    jobName: string,
    pattern: string,
  ) {
    if (isMockQueueConnection(this.connection)) {
      return Promise.resolve({ id: schedulerId, name: jobName, pattern });
    }
    return this.getQueue(name).upsertJobScheduler(
      schedulerId,
      { pattern },
      { name: jobName, data: {} },
    );
  }

  scheduleEvery(
    name: QueueName,
    schedulerId: string,
    jobName: string,
    everyMs: number,
  ) {
    if (isMockQueueConnection(this.connection)) {
      return Promise.resolve({ id: schedulerId, name: jobName, everyMs });
    }
    return this.getQueue(name).upsertJobScheduler(
      schedulerId,
      { every: everyMs },
      { name: jobName, data: {} },
    );
  }

  async waitingCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const name of Object.values(QUEUE_NAMES)) {
      if (isMockQueueConnection(this.connection)) {
        counts[name] = 0;
        continue;
      }
      const queue = this.queues.get(name);
      counts[name] = queue ? await queue.getWaitingCount() : 0;
    }
    return counts;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
