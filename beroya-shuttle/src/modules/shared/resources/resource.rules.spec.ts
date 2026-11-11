import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import {
  assertInstitutionCanMutate,
  buildResourceStats,
  canSeeBeroyaResources,
  isAssigned,
} from './resource.rules';

describe('resource.rules', () => {
  it('shows Beroya resources only for BEROYA_OPERATED', () => {
    expect(canSeeBeroyaResources('INSTITUTION_OPERATED')).toBe(false);
    expect(canSeeBeroyaResources('BEROYA_OPERATED')).toBe(true);
  });

  it('rejects institution mutation of a Beroya or driver-owned resource', () => {
    try {
      assertInstitutionCanMutate('BEROYA');
      fail('expected RESOURCE_OWNED_BY_BEROYA');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'RESOURCE_OWNED_BY_BEROYA',
      });
    }
    expect(() => assertInstitutionCanMutate('DRIVER')).toThrow(AppException);
    expect(() => assertInstitutionCanMutate('INSTITUTION')).not.toThrow();
  });

  it('builds assigned / unassigned stats', () => {
    expect(
      buildResourceStats([
        { status: 'ACTIVE', assigned: true },
        { status: 'ACTIVE', assigned: false },
        { status: 'SUSPENDED', assigned: false },
      ]),
    ).toMatchObject({
      total: 3,
      active: 2,
      suspended: 1,
      assigned: 1,
      unassigned: 2,
    });
    expect(isAssigned(1)).toBe(true);
    expect(isAssigned(0)).toBe(false);
  });
});
