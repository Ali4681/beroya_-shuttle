import { Injectable, Logger } from '@nestjs/common';
import {
  FcmPlatformPayload,
  FcmProvider,
  FcmSendResult,
} from './fcm.types';

@Injectable()
export class MockFcmProvider implements FcmProvider {
  private readonly logger = new Logger(MockFcmProvider.name);

  send(payload: FcmPlatformPayload): Promise<FcmSendResult> {
    let successCount = 0;
    const invalidTokens: string[] = [];
    for (const token of payload.tokens) {
      if (token.startsWith('dead-') || token.includes('UNREGISTERED')) {
        invalidTokens.push(token);
        continue;
      }
      successCount += 1;
    }
    this.logger.debug(
      `mock FCM ${successCount} ok / ${invalidTokens.length} dead (priority=${payload.highPriority === true})`,
    );
    return Promise.resolve({
      successCount,
      failureCount: invalidTokens.length,
      invalidTokens,
    });
  }
}
