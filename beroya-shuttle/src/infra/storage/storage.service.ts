import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { mkdir, readFile, stat as fsStat, writeFile } from 'fs/promises';
import { imageSize } from 'image-size';
import { Client } from 'minio';
import { dirname, resolve } from 'path';
import { AppException } from '../../common/errors/app.exception';
import { Env } from '../../config/env.schema';
import { PRESIGN_TTL_SECONDS } from './storage.constants';

export type StoredImage = {
  key: string;
  byteSize: number;
  width: number;
  height: number;
};

type StorageDriver = 'r2' | 'minio' | 'local';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client | null;
  private readonly bucket: string;
  private readonly privateBucket: string | null;
  private readonly objectPublicBase: string;
  private readonly localPublicBase: string;
  private readonly localPutBase: string;
  private readonly localRoot: string;
  private readonly ticketSecret: string;
  private readonly allowLocalFallback: boolean;
  private readonly useR2: boolean;
  private readonly uploadTtlSeconds: number;
  private readonly downloadTtlSeconds: number;
  private driver: StorageDriver | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.useR2 = Boolean(
      config.get('R2_ACCESS_KEY_ID', { infer: true }) &&
        config.get('R2_SECRET_ACCESS_KEY', { infer: true }) &&
        config.get('R2_S3_ENDPOINT', { infer: true }) &&
        config.get('R2_PUBLIC_BUCKET', { infer: true }) &&
        config.get('R2_PUBLIC_BASE_URL', { infer: true }),
    );
    this.uploadTtlSeconds =
      config.get('R2_PRESIGNED_UPLOAD_TTL_SECONDS', { infer: true }) ??
      PRESIGN_TTL_SECONDS;
    this.downloadTtlSeconds =
      config.get('R2_PRESIGNED_DOWNLOAD_TTL_SECONDS', { infer: true }) ?? 300;

    if (this.useR2) {
      const endpointUrl = new URL(
        config.get('R2_S3_ENDPOINT', { infer: true })!,
      );
      const region = config.get('R2_REGION', { infer: true });
      this.bucket = config.get('R2_PUBLIC_BUCKET', { infer: true })!;
      this.privateBucket =
        config.get('R2_PRIVATE_BUCKET', { infer: true }) ?? null;
      this.objectPublicBase = config
        .get('R2_PUBLIC_BASE_URL', { infer: true })!
        .replace(/\/$/, '');
      this.client = new Client({
        endPoint: endpointUrl.hostname,
        port: endpointUrl.port
          ? Number(endpointUrl.port)
          : endpointUrl.protocol === 'https:'
            ? 443
            : 80,
        useSSL: endpointUrl.protocol === 'https:',
        accessKey: config.get('R2_ACCESS_KEY_ID', { infer: true })!,
        secretKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true })!,
        region,
      });
    } else {
      const endPoint = config.get('MINIO_ENDPOINT', { infer: true })!;
      const port = config.get('MINIO_PORT', { infer: true });
      const useSSL = config.get('MINIO_USE_SSL', { infer: true });
      this.bucket = config.get('MINIO_BUCKET', { infer: true });
      this.privateBucket = null;
      this.client = new Client({
        endPoint,
        port,
        useSSL,
        accessKey: config.get('MINIO_ACCESS_KEY', { infer: true })!,
        secretKey: config.get('MINIO_SECRET_KEY', { infer: true })!,
      });
      const publicUrl = config.get('MINIO_PUBLIC_URL', { infer: true });
      this.objectPublicBase =
        publicUrl?.replace(/\/$/, '') ??
        `${useSSL ? 'https' : 'http'}://${endPoint}${port === 80 || port === 443 ? '' : `:${port}`}/${this.bucket}`;
    }

    const apiPort = config.get('PORT', { infer: true });
    const prefix = config.get('API_PREFIX', { infer: true });
    const apiOrigin = `http://localhost:${apiPort}/${prefix}`;
    this.localPublicBase = `${apiOrigin}/local-storage/objects`;
    this.localPutBase = `${apiOrigin}/local-storage/put`;
    this.localRoot = resolve(process.cwd(), '.data', 'uploads');
    this.ticketSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.allowLocalFallback =
      !this.useR2 && config.get('NODE_ENV', { infer: true }) !== 'production';
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureReady();
      this.logger.log(
        `Storage ready via ${this.driver} (bucket=${this.bucket})`,
      );
    } catch (error) {
      this.logger.warn(
        `Storage is not ready (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }

  presignUploadTtlSeconds(): number {
    return this.uploadTtlSeconds;
  }

  publicUrl(key: string): string {
    return `${this.publicBase()}/${key}`;
  }

  isManagedUrl(url: string): boolean {
    return this.keyFromUrl(url) !== null;
  }

  keyFromUrl(url: string): string | null {
    for (const prefix of [
      `${this.objectPublicBase}/`,
      `${this.localPublicBase}/`,
    ]) {
      if (url.startsWith(prefix)) {
        return url.slice(prefix.length);
      }
    }
    return null;
  }

  async presignPut(key: string): Promise<string> {
    await this.ensureReady();
    // R2 (and local fallback) go through the API so the browser never hits
    // cross-origin storage CORS. MinIO keeps direct presigned PUTs.
    if (this.driver === 'local' || this.driver === 'r2') {
      return `${this.localPutBase}/${this.signTicket(key)}`;
    }
    return this.requireClient().presignedPutObject(
      this.bucket,
      key,
      this.uploadTtlSeconds,
    );
  }

  async presignGet(key: string, privateObject = false): Promise<string> {
    await this.ensureReady();
    if (this.driver === 'local') {
      return this.publicUrl(key);
    }
    const bucket =
      privateObject && this.privateBucket ? this.privateBucket : this.bucket;
    return this.requireClient().presignedGetObject(
      bucket,
      key,
      this.downloadTtlSeconds,
    );
  }

  async stat(key: string): Promise<{ size: number } | null> {
    await this.ensureReady();
    if (this.driver === 'local') {
      try {
        const info = await fsStat(this.localPath(key));
        return { size: info.size };
      } catch {
        return null;
      }
    }
    try {
      const result = await this.requireClient().statObject(this.bucket, key);
      return { size: result.size };
    } catch {
      return null;
    }
  }

  async readBuffer(key: string): Promise<Buffer> {
    await this.ensureReady();
    return this.readBytes(key);
  }

  async readImage(key: string): Promise<StoredImage> {
    await this.ensureReady();
    const buffer = await this.readBytes(key);
    let info: { width?: number; height?: number };
    try {
      info = imageSize(buffer);
    } catch {
      throw new AppException(
        'UPLOAD_INVALID_IMAGE',
        'The uploaded file is not a readable image',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!info.width || !info.height) {
      throw new AppException(
        'UPLOAD_INVALID_IMAGE',
        'The uploaded file is not a readable image',
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      key,
      byteSize: buffer.length,
      width: info.width,
      height: info.height,
    };
  }

  async putFromTicket(
    ticket: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<string> {
    const key = this.verifyTicket(ticket);
    await this.ensureReady();
    if (this.driver === 'local') {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, buffer);
      return key;
    }
    if (this.driver !== 'r2') {
      throw new AppException(
        'STORAGE_UNAVAILABLE',
        'Proxied upload tickets are only valid for R2 or local storage',
        HttpStatus.BAD_REQUEST,
      );
    }
    const ext = key.split('.').pop()?.toLowerCase();
    const resolvedType =
      contentType ||
      (ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'json'
              ? 'application/json'
              : 'image/png');
    await this.requireClient().putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': resolvedType,
    });
    return key;
  }

  async readPublicObject(
    key: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    await this.ensureReady();
    const buffer = await this.readBytes(key);
    const ext = key.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'json'
              ? 'application/json'
              : 'image/png';
    return { buffer, contentType };
  }

  private publicBase(): string {
    return this.driver === 'local' ? this.localPublicBase : this.objectPublicBase;
  }

  private requireClient(): Client {
    if (!this.client) {
      throw new AppException(
        'STORAGE_UNAVAILABLE',
        'File storage is not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.client;
  }

  private async ensureReady(): Promise<void> {
    if (this.driver) {
      return;
    }
    try {
      const client = this.requireClient();
      const exists = await client.bucketExists(this.bucket);
      if (!exists) {
        if (this.useR2) {
          throw new Error(`R2 bucket "${this.bucket}" does not exist`);
        }
        await client.makeBucket(this.bucket);
      }
      if (!this.useR2) {
        await client.setBucketPolicy(
          this.bucket,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        );
      }
      this.driver = this.useR2 ? 'r2' : 'minio';
    } catch (error) {
      if (!this.allowLocalFallback) {
        throw new AppException(
          'STORAGE_UNAVAILABLE',
          'File storage is not available',
          HttpStatus.SERVICE_UNAVAILABLE,
          {
            reason: error instanceof Error ? error.message : 'unknown',
          },
        );
      }
      await mkdir(this.localRoot, { recursive: true });
      this.driver = 'local';
      this.logger.warn(
        'Object storage is not reachable; using local disk storage for development',
      );
    }
  }

  private async readBytes(key: string): Promise<Buffer> {
    if (this.driver === 'local') {
      try {
        return await readFile(this.localPath(key));
      } catch {
        throw new AppException(
          'UPLOAD_NOT_FOUND',
          'Upload the file to the presigned URL before completing',
          HttpStatus.NOT_FOUND,
        );
      }
    }
    const chunks: Buffer[] = [];
    const stream = await this.requireClient().getObject(this.bucket, key);
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private localPath(key: string): string {
    const allowed =
      key.startsWith('institutions/') ||
      key.startsWith('platform/app-branding/');
    if (key.includes('..') || !allowed) {
      throw new AppException(
        'UPLOAD_KEY_FORBIDDEN',
        'This file does not belong to the institution',
        HttpStatus.FORBIDDEN,
      );
    }
    const path = resolve(this.localRoot, key);
    if (!path.startsWith(this.localRoot)) {
      throw new AppException(
        'UPLOAD_KEY_FORBIDDEN',
        'This file does not belong to the institution',
        HttpStatus.FORBIDDEN,
      );
    }
    return path;
  }

  private signTicket(key: string): string {
    const exp = Date.now() + this.uploadTtlSeconds * 1000;
    const payload = Buffer.from(JSON.stringify({ key, exp })).toString(
      'base64url',
    );
    const sig = createHmac('sha256', this.ticketSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyTicket(ticket: string): string {
    const [payload, sig] = ticket.split('.');
    if (!payload || !sig) {
      throw new AppException(
        'UPLOAD_NOT_FOUND',
        'Upload ticket is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }
    const expected = createHmac('sha256', this.ticketSecret)
      .update(payload)
      .digest('base64url');
    if (expected !== sig) {
      throw new AppException(
        'UPLOAD_NOT_FOUND',
        'Upload ticket is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      key?: string;
      exp?: number;
    };
    if (!parsed.key || !parsed.exp || parsed.exp < Date.now()) {
      throw new AppException(
        'UPLOAD_NOT_FOUND',
        'Upload ticket is invalid or expired',
        HttpStatus.BAD_REQUEST,
      );
    }
    return parsed.key;
  }
}
