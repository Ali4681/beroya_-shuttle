import 'dotenv/config';
import Redis from 'ioredis';

jest.setTimeout(120_000);

type PgClient = {
  connect: () => Promise<void>;
  query: (sql: string) => Promise<{ rows: Array<{ ok: number }> }>;
  end: () => Promise<void>;
};

describe('phase14 real postgres + redis', () => {
  it('accepts a query against DATABASE_URL (CI services or local)', async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return;
    }
    const pg = (await import('pg')) as unknown as {
      Client: new (config: { connectionString: string }) => PgClient;
      default?: {
        Client: new (config: { connectionString: string }) => PgClient;
      };
    };
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) {
      throw new Error('pg Client is not available');
    }
    const client = new Client({ connectionString: url });
    await client.connect();
    const result = await client.query('SELECT 1 AS ok');
    expect(Number(result.rows[0]?.ok ?? 0)).toBe(1);
    await client.end();
  });

  it('pings Redis when MOCK_REDIS is not enabled', async () => {
    if (process.env.MOCK_REDIS === 'true') {
      return;
    }
    const host = process.env.REDIS_HOST;
    if (!host) {
      return;
    }
    const redis = new Redis({
      host,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
    expect(await redis.ping()).toBe('PONG');
    redis.disconnect();
  });
});
