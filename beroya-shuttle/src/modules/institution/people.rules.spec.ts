import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { normalizePickup } from './people.rules';

describe('people.rules', () => {
  it('requires coordinates for HOME pickup', () => {
    try {
      normalizePickup({ pickupType: 'HOME' });
      fail('expected PICKUP_HOME_LOCATION_REQUIRED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'PICKUP_HOME_LOCATION_REQUIRED',
      });
    }
  });

  it('keeps home coordinates and drops a meeting point', () => {
    expect(
      normalizePickup({
        pickupType: 'HOME',
        latitude: 33.5,
        longitude: 36.2,
        meetingPointId: 'mp-ignored',
      }),
    ).toEqual({
      pickupType: 'HOME',
      meetingPointId: null,
      latitude: 33.5,
      longitude: 36.2,
    });
  });

  it('requires a meeting point id', () => {
    try {
      normalizePickup({ pickupType: 'MEETING_POINT' });
      fail('expected PICKUP_MEETING_POINT_REQUIRED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'PICKUP_MEETING_POINT_REQUIRED',
      });
    }
  });

  it('ignores coordinates for MEETING_POINT pickup', () => {
    expect(
      normalizePickup({
        pickupType: 'MEETING_POINT',
        meetingPointId: 'mp-1',
        latitude: 33.5,
        longitude: 36.2,
      }),
    ).toEqual({
      pickupType: 'MEETING_POINT',
      meetingPointId: 'mp-1',
      latitude: null,
      longitude: null,
    });
  });
});
