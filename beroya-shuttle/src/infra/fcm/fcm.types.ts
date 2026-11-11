export type FcmPlatformPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  tokens: string[];
  highPriority?: boolean;
  android?: { priority: 'high'; channelId: string };
  apns?: {
    interruptionLevel: 'time-sensitive';
    sound: string;
    contentAvailable: boolean;
  };
};

export type FcmSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
};

export interface FcmProvider {
  send(payload: FcmPlatformPayload): Promise<FcmSendResult>;
}

export const FCM_PROVIDER = Symbol('FCM_PROVIDER');
export const FCM_BATCH_SIZE = 500;
export const DEAD_TOKEN_CODES = new Set([
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
