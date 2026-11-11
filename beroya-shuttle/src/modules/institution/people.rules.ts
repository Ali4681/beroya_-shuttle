import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PickupType } from '../../generated/prisma/client';

export type PickupInput = {
  pickupType: PickupType;
  meetingPointId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function normalizePickup(input: PickupInput): {
  pickupType: PickupType;
  meetingPointId: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  if (input.pickupType === PickupType.HOME) {
    if (input.latitude == null || input.longitude == null) {
      throw new AppException(
        'PICKUP_HOME_LOCATION_REQUIRED',
        'Home pickup requires latitude and longitude',
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      pickupType: PickupType.HOME,
      meetingPointId: null,
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  if (!input.meetingPointId) {
    throw new AppException(
      'PICKUP_MEETING_POINT_REQUIRED',
      'Meeting-point pickup requires meeting_point_id',
      HttpStatus.BAD_REQUEST,
    );
  }
  return {
    pickupType: PickupType.MEETING_POINT,
    meetingPointId: input.meetingPointId,
    latitude: null,
    longitude: null,
  };
}
