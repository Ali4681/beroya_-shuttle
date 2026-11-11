import { validateEnv } from './env.schema';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://beroya:beroya@localhost:5432/beroya_shuttle',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
  JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
};

describe('validateEnv', () => {
  it('accepts a complete environment', () => {
    const env = validateEnv(validEnv);
    expect(env.API_PREFIX).toBe('api/v1/shuttle');
    expect(env.MINIO_USE_SSL).toBe(false);
    expect(env.MOCK_REDIS).toBe(false);
    // OTP parked — restore with OTP_DEV_CODE in env.schema.
    // expect(env.OTP_DEV_CODE).toBe('000000');
  });

  it('enables MOCK_REDIS from env', () => {
    const env = validateEnv({
      ...validEnv,
      MOCK_REDIS: 'true',
    });
    expect(env.MOCK_REDIS).toBe(true);
  });

  it('rejects MOCK_REDIS in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        MOCK_REDIS: 'true',
      }),
    ).toThrow(/MOCK_REDIS cannot be enabled in production/);
  });

  it('fails fast when a required variable is missing', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        DATABASE_URL: undefined,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('accepts Cloudflare R2 without MinIO', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL: 'postgresql://beroya:beroya@localhost:5432/beroya_shuttle',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
      JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
      R2_ACCESS_KEY_ID: 'r2-access',
      R2_SECRET_ACCESS_KEY: 'r2-secret',
      R2_S3_ENDPOINT: 'https://abc.r2.cloudflarestorage.com',
      R2_PUBLIC_BUCKET: 'pluson-public',
      R2_PUBLIC_BASE_URL: 'https://media.example.com',
      R2_PRESIGNED_UPLOAD_TTL_SECONDS: '900',
    });
    expect(env.R2_PUBLIC_BUCKET).toBe('pluson-public');
    expect(env.R2_PRESIGNED_UPLOAD_TTL_SECONDS).toBe(900);
    expect(env.R2_REGION).toBe('auto');
  });

  it('rejects when neither R2 nor MinIO is configured', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        DATABASE_URL: 'postgresql://beroya:beroya@localhost:5432/beroya_shuttle',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
      }),
    ).toThrow(/Cloudflare R2|MinIO/);
  });
});
