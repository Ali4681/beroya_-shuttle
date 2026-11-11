import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeCoreModule {}

@Module({
  imports: [AuthModule, RealtimeCoreModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
