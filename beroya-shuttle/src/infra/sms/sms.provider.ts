// OTP parked — restore with SmsModule in app.module.ts.
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}
