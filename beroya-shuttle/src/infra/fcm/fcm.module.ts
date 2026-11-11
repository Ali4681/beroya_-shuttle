import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { FirebaseFcmProvider } from './firebase-fcm.provider';
import { FCM_PROVIDER, FcmProvider } from './fcm.types';
import { MockFcmProvider } from './mock-fcm.provider';

@Global()
@Module({
  providers: [
    MockFcmProvider,
    {
      provide: FCM_PROVIDER,
      inject: [ConfigService, MockFcmProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockFcmProvider,
      ): FcmProvider => {
        const json = config.get('FIREBASE_SERVICE_ACCOUNT_JSON', {
          infer: true,
        });
        if (!json) {
          new Logger('FcmModule').warn(
            'FIREBASE_SERVICE_ACCOUNT_JSON missing — using mock FCM',
          );
          return mock;
        }
        try {
          return new FirebaseFcmProvider(json);
        } catch (error) {
          new Logger('FcmModule').error(
            `FIREBASE_SERVICE_ACCOUNT_JSON is invalid — using mock FCM: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return mock;
        }
      },
    },
  ],
  exports: [FCM_PROVIDER],
})
export class FcmModule {}
