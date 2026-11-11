import { Injectable } from '@nestjs/common';

type TenantDelegate = {
  findFirst: (args: {
    where: { id: string; institutionId: string };
  }) => Promise<unknown>;
};

@Injectable()
export class PrismaTenantHelper {
  findOwned<T>(
    delegate: TenantDelegate,
    id: string,
    institutionId: string,
  ): Promise<T | null> {
    return delegate.findFirst({
      where: { id, institutionId },
    }) as Promise<T | null>;
  }

  whereTenant<T extends Record<string, unknown>>(
    institutionId: string,
    where: T = {} as T,
  ): T & { institutionId: string } {
    return { ...where, institutionId };
  }
}
