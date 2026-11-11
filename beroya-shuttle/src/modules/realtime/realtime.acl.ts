import { OperationModel, ShuttleRole } from '../../generated/prisma/client';
import { AuthUser } from '../../common/types/auth-user';
import {
  ADMIN_BEROYA_ROOM,
  institutionRoom,
  routeRoom,
  tripRoom,
} from './realtime.constants';

export type RoomTarget =
  | { kind: 'institution'; institutionId: string }
  | { kind: 'trip'; tripId: string }
  | { kind: 'route'; routeId: string }
  | { kind: 'admin' };

export function parseRoom(room: string): RoomTarget | null {
  if (room === ADMIN_BEROYA_ROOM) {
    return { kind: 'admin' };
  }
  const [kind, id] = room.split(':');
  if (!id) {
    return null;
  }
  if (kind === 'institution') {
    return { kind: 'institution', institutionId: id };
  }
  if (kind === 'trip') {
    return { kind: 'trip', tripId: id };
  }
  if (kind === 'route') {
    return { kind: 'route', routeId: id };
  }
  return null;
}

export function canJoinInstitution(
  user: AuthUser,
  institutionId: string,
  operationModel: OperationModel | null,
): boolean {
  if (user.role === ShuttleRole.BEROYA_ADMIN) {
    return isBeroyaOperated(operationModel);
  }
  return user.institutionId === institutionId;
}

export function canJoinAdminBeroya(user: AuthUser): boolean {
  return user.role === ShuttleRole.BEROYA_ADMIN;
}

export function isBeroyaOperated(
  operationModel: OperationModel | null | undefined,
): boolean {
  return operationModel === OperationModel.BEROYA_OPERATED;
}

export function roomsForTrip(input: {
  institutionId: string;
  tripId: string;
  routeId: string;
}): string[] {
  return [
    institutionRoom(input.institutionId),
    tripRoom(input.tripId),
    routeRoom(input.routeId),
  ];
}
