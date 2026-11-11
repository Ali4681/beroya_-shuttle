import { Logger } from '@nestjs/common';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import {
  getMessaging,
  type Messaging,
  type MulticastMessage,
} from 'firebase-admin/messaging';
import {
  DEAD_TOKEN_CODES,
  FcmPlatformPayload,
  FcmProvider,
  FcmSendResult,
} from './fcm.types';

const APP_NAME = 'beroya-fcm';

export class FirebaseFcmProvider implements FcmProvider {
  private readonly logger = new Logger(FirebaseFcmProvider.name);
  private readonly messaging: Messaging;

  constructor(serviceAccountJson: string) {
    const account = JSON.parse(serviceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    const app: App =
      getApps().find((existing) => existing.name === APP_NAME) ??
      initializeApp(
        {
          credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKey: account.private_key.replace(/\\n/g, '\n'),
          }),
          projectId: account.project_id,
        },
        APP_NAME,
      );
    this.messaging = getMessaging(app);
  }

  async send(payload: FcmPlatformPayload): Promise<FcmSendResult> {
    if (payload.tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const message: MulticastMessage = {
      tokens: payload.tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: {
        priority: payload.highPriority ? 'high' : 'normal',
        notification: payload.android
          ? { channelId: payload.android.channelId, sound: 'default' }
          : undefined,
      },
      apns: payload.apns
        ? {
            headers: { 'apns-priority': '10' },
            payload: {
              aps: {
                sound: payload.apns.sound,
                contentAvailable: payload.apns.contentAvailable,
                'interruption-level': payload.apns.interruptionLevel,
              },
            },
          }
        : undefined,
      webpush: {
        headers: { Urgency: payload.highPriority ? 'high' : 'normal' },
        notification: { title: payload.title, body: payload.body },
      },
    };

    const response = await this.messaging.sendEachForMulticast(message);
    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code ?? '';
      if (DEAD_TOKEN_CODES.has(code)) {
        invalidTokens.push(payload.tokens[index]);
      } else {
        this.logger.warn(`FCM send failed (${code}): ${result.error?.message}`);
      }
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  }
}
