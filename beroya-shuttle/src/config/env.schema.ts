import { z } from 'zod';

const booleanFromEnv = z
  .preprocess(
    (value) => {
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      if (typeof value === 'string') {
        return value.toLowerCase();
      }
      return 'false';
    },
    z.enum(['true', 'false']),
  )
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().min(1).default('api/v1/shuttle'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  MOCK_REDIS: booleanFromEnv,

  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // OTP parked — restore with SmsModule + /auth/otp.
  // OTP_DEV_CODE: z.string().min(4).default('000000'),
  // OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  CORS_ORIGINS: z.string().min(1).default('http://localhost:3000'),

  // Local MinIO (optional when Cloudflare R2 is fully configured)
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().min(1).default('beroya-shuttle'),
  MINIO_USE_SSL: booleanFromEnv,
  MINIO_PUBLIC_URL: z.string().optional(),

  // Cloudflare R2 — preferred media backend when present
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_BUCKET: z.string().optional(),
  R2_PRIVATE_BUCKET: z.string().optional(),
  R2_S3_ENDPOINT: z.string().url().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  R2_REGION: z.string().min(1).default('auto'),
  R2_PRESIGNED_UPLOAD_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  R2_PRESIGNED_DOWNLOAD_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  R2_MULTIPART_THRESHOLD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(104_857_600),
  MEDIA_ORPHAN_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),

  SEED_ADMIN_PHONE: z.string().min(1).default('+963900000000'),
  SEED_ADMIN_NAME: z.string().min(1).default('Beroya Admin'),

  OSRM_BASE_URL: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

function hasR2(env: Env): boolean {
  return Boolean(
    env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_S3_ENDPOINT &&
      env.R2_PUBLIC_BUCKET &&
      env.R2_PUBLIC_BASE_URL,
  );
}

function hasMinio(env: Env): boolean {
  return Boolean(
    env.MINIO_ENDPOINT && env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY,
  );
}

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.MOCK_REDIS) {
    throw new Error('MOCK_REDIS cannot be enabled in production');
  }
  if (!hasR2(parsed.data) && !hasMinio(parsed.data)) {
    throw new Error(
      'Invalid environment variables:\n  - Configure Cloudflare R2 (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT, R2_PUBLIC_BUCKET, R2_PUBLIC_BASE_URL) or MinIO (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)',
    );
  }

  return parsed.data;
}
