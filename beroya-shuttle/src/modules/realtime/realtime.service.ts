import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { OperationModel } from '../../generated/prisma/client';
import { isBeroyaOperated, roomsForTrip } from './realtime.acl';
import {
  ADMIN_BEROYA_ROOM,
  RealtimeEvent,
} from './realtime.constants';

export type RealtimeTripContext = {
  institutionId: string;
  tripId: string;
  routeId: string;
  operationModel?: OperationModel | null;
};

@Injectable()
export class RealtimeService {
  private server?: Server;

  attach(server: Server): void {
    this.server = server;
  }

  emitTrip(
    event: RealtimeEvent,
    ctx: RealtimeTripContext,
    data: Record<string, unknown> = {},
  ): void {
    if (!this.server) {
      return;
    }
    const payload = {
      event,
      trip_id: ctx.tripId,
      institution_id: ctx.institutionId,
      route_id: ctx.routeId,
      ...data,
    };
    for (const room of roomsForTrip(ctx)) {
      this.server.to(room).emit(event, payload);
    }
    if (isBeroyaOperated(ctx.operationModel)) {
      this.server.to(ADMIN_BEROYA_ROOM).emit(event, payload);
    }
  }
}
