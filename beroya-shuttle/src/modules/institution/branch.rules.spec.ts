import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { assertBranchEmpty } from './branch.rules';

describe('branch.rules', () => {
  it('allows deleting an empty branch', () => {
    expect(() => assertBranchEmpty({ students: 0, routes: 0 })).not.toThrow();
  });

  it('rejects a branch with active students or routes', () => {
    try {
      assertBranchEmpty({ students: 1, routes: 0 });
      fail('expected BRANCH_NOT_EMPTY');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'BRANCH_NOT_EMPTY',
      });
    }
  });
});
