import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export function Idempotent() {
  return SetMetadata(IDEMPOTENT_KEY, true);
}
