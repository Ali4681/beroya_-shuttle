// OTP parked — restore with /auth/otp routes.
// export const OTP_MAX_ATTEMPTS = 5;
// export const OTP_THROTTLE_SECONDS = 60;
// export const OTP_PHONE_HOURLY_LIMIT = 5;
// export const OTP_IP_HOURLY_LIMIT = 20;
// export const OTP_HOUR_WINDOW_SECONDS = 60 * 60;
// export const otpKey = (phone: string) => `otp:${phone}`;
// export const otpThrottleKey = (phone: string) => `otp:throttle:${phone}`;
// export const otpPhoneHourKey = (phone: string) => `otp:hour:phone:${phone}`;
// export const otpIpHourKey = (ip: string) => `otp:hour:ip:${ip}`;

export function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    return 15 * 60;
  }
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 60 * 60;
  return value * 60 * 60 * 24;
}
