import { Global, Module } from '@nestjs/common';
import { PrismaTenantHelper } from './prisma-tenant.helper';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, PrismaTenantHelper],
  exports: [PrismaService, PrismaTenantHelper],
})
export class PrismaModule {}
