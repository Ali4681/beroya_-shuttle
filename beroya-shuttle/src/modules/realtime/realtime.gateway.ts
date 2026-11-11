import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../../common/types/auth-user';
import { localeFromRequest, translateError } from '../../common/i18n';
import { Env } from '../../config/env.schema';
import { ShuttleRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  canJoinAdminBeroya,
  canJoinInstitution,
  parseRoom,
} from './realtime.acl';
import { REALTIME_NAMESPACE } from './realtime.constants';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.authenticate(client);
    if (!user) {
      const locale = localeFromRequest({
        headers: client.handshake.headers,
        query: client.handshake.query,
      });
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: translateError('UNAUTHORIZED', undefined, locale),
      });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room?: string },
  ) {
    const user =
      (client.data.user as AuthUser | undefined) ??
      (await this.authenticate(client));
    const room = body?.room?.trim();
    if (!user || !room) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }

    const allowed = await this.canJoin(user, room);
    if (!allowed) {
      this.logger.debug(`Denied ${user.sub} subscribe ${room}`);
      return { ok: false, code: 'ROOM_FORBIDDEN' };
    }

    await client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room?: string },
  ) {
    const room = body?.room?.trim();
    if (!room) {
      return { ok: false, code: 'ROOM_REQUIRED' };
    }
    await client.leave(room);
    return { ok: true, room };
  }

  private async canJoin(user: AuthUser, room: string): Promise<boolean> {
    const target = parseRoom(room);
    if (!target) {
      return false;
    }
    if (target.kind === 'admin') {
      return canJoinAdminBeroya(user);
    }
    if (target.kind === 'institution') {
      const institution = await this.prisma.institution.findFirst({
        where: { id: target.institutionId, archivedAt: null },
        select: { operationModel: true },
      });
      return canJoinInstitution(
        user,
        target.institutionId,
        institution?.operationModel ?? null,
      );
    }
    if (target.kind === 'trip') {
      const trip = await this.prisma.shuttleTrip.findUnique({
        where: { id: target.tripId },
        select: {
          institutionId: true,
          driverId: true,
          attendantId: true,
          institution: { select: { operationModel: true } },
          students: { select: { student: { select: { guardianUserId: true } } } },
        },
      });
      if (!trip) {
        return false;
      }
      if (
        canJoinInstitution(
          user,
          trip.institutionId,
          trip.institution.operationModel,
        )
      ) {
        return true;
      }
      if (user.role === ShuttleRole.DRIVER && trip.driverId) {
        const driver = await this.prisma.driverProfile.findFirst({
          where: { id: trip.driverId, userId: user.sub },
        });
        return Boolean(driver);
      }
      if (user.role === ShuttleRole.ATTENDANT && trip.attendantId) {
        const attendant = await this.prisma.attendantProfile.findFirst({
          where: { id: trip.attendantId, userId: user.sub },
        });
        return Boolean(attendant);
      }
      if (user.role === ShuttleRole.PARENT) {
        return trip.students.some(
          (row) => row.student.guardianUserId === user.sub,
        );
      }
      return false;
    }

    const route = await this.prisma.shuttleRoute.findFirst({
      where: { id: target.routeId, archivedAt: null },
      select: {
        institutionId: true,
        institution: { select: { operationModel: true } },
      },
    });
    if (!route) {
      return false;
    }
    return canJoinInstitution(
      user,
      route.institutionId,
      route.institution.operationModel,
    );
  }

  private async authenticate(client: Socket): Promise<AuthUser | null> {
    try {
      const token = this.readToken(client);
      if (!token) {
        return null;
      }
      const user = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      const session = await this.prisma.userSession.findFirst({
        where: {
          id: user.sessionId,
          userId: user.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session) {
        return null;
      }
      client.data.user = user;
      return user;
    } catch {
      return null;
    }
  }

  private readToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      return auth.token;
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    const queryToken = client.handshake.query.token;
    return typeof queryToken === 'string' ? queryToken : undefined;
  }
}
