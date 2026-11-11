import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  assertCanReportIncident,
  assertIncidentMatchesTrip,
  assertIncidentOpen,
} from './incident.rules';

describe('incident.rules', () => {
  it('keeps reporting on in-progress trips only', () => {
    expect(() => assertCanReportIncident('IN_PROGRESS')).not.toThrow();
    try {
      assertCanReportIncident('SCHEDULED');
      fail('expected TRIP_NOT_STARTED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(() => assertCanReportIncident('COMPLETED')).toThrow(AppException);
    expect(() => assertCanReportIncident('CANCELLED')).toThrow(AppException);
  });

  it('rejects resolving an already resolved incident', () => {
    try {
      assertIncidentOpen('RESOLVED');
      fail('expected INCIDENT_ALREADY_RESOLVED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('rejects linking a reassignment to another trip incident', () => {
    expect(() => assertIncidentMatchesTrip('trip-a', 'trip-a')).not.toThrow();
    expect(() => assertIncidentOpen('OPEN')).not.toThrow();
    try {
      assertIncidentMatchesTrip('trip-a', 'trip-b');
      fail('expected INCIDENT_TRIP_MISMATCH');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
    }
  });
});
