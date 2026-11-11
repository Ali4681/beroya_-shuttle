import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

export function assertBranchEmpty(counts: {
  students: number;
  routes: number;
}): void {
  if (counts.students > 0 || counts.routes > 0) {
    throw new AppException(
      'BRANCH_NOT_EMPTY',
      'Branch still has active students or routes',
      HttpStatus.CONFLICT,
      counts,
    );
  }
}
