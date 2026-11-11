import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

// OTP parked — restore with SmsModule in app.module.ts.
@Injectable()
export class DevSmsProvider implements SmsProvider {
  private readonly logger = new Logger(DevSmsProvider.name);

  sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code}`);
    return Promise.resolve();
  }
}
