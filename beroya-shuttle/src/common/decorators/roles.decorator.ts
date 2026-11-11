import { SetMetadata } from '@nestjs/common';
import { ShuttleRole } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: ShuttleRole[]) => SetMetadata(ROLES_KEY, roles);
