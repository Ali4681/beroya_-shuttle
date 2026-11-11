import { Injectable } from '@nestjs/common';
import { Prisma, TripEventType } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export type TripEventInput = {
  tripId: string;
  type: TripEventType;
  actorUserId?: string | null;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  occurredAt?: Date;
};

@Injectable()
export class TripEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: TripEventInput, db: Db = this.prisma) {
    return db.tripEvent.create({
      data: {
        tripId: input.tripId,
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        title: input.title,
        description: input.description,
        data: input.data as Prisma.InputJsonValue | undefined,
        occurredAt: input.occurredAt,
      },
    });
  }
}
