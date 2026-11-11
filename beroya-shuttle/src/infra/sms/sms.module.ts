// OTP parked — this module is not imported from AppModule.
// Re-enable by uncommenting SmsModule in app.module.ts and /auth/otp routes.
import { Global, Module } from '@nestjs/common';
import { DevSmsProvider } from './dev-sms.provider';
import { SMS_PROVIDER } from './sms.provider';

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useClass: DevSmsProvider,
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
