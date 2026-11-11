import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { Env } from './config/env.schema';
import { applySwaggerContract } from './swagger/swagger-contract';

async function bootstrap(): Promise<void> {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0.1 });
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const prefix = configureApp(app);
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Beroya On + API')
    .setDescription(
      'Beroya On + backend contract. Errors use `{ error: { code, message, details } }`. Sensitive POSTs accept `Idempotency-Key`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'Idempotency-Key', in: 'header' },
      'Idempotency-Key',
    )
    .build();
  const document = applySwaggerContract(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`API listening on http://localhost:${port}/${prefix}`);
  logger.log(`Swagger at http://localhost:${port}/${prefix}/docs`);
  logger.log(`Health at http://localhost:${port}/health`);
  logger.log(`Metrics at http://localhost:${port}/metrics`);
}

void bootstrap();

