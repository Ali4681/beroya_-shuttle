import { HttpStatus } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppException } from '../errors/app.exception';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 32;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmailAndPassword(email: string | undefined, password: string | undefined): void {
  if (!email?.trim() || !password || password.length < 8) {
    throw new AppException(
      'EMAIL_PASSWORD_REQUIRED',
      'Email and password are required',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = (await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
