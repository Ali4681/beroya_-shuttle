import type Redis from 'ioredis';
import { InMemoryRedis } from './in-memory-redis';

export type RedisClient = Redis | InMemoryRedis;
