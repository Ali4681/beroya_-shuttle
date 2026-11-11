describe('live API e2e', () => {
  const base = process.env.PHASE14_E2E_BASE;
  const live = base ? it : it.skip;

  live('GET /health returns postgres and redis checks', async () => {
    const origin = new URL(base as string).origin;
    const response = await fetch(`${origin}/health`);
    const body = (await response.json()) as {
      data: { checks: { postgres?: unknown; redis?: unknown } };
    };
    expect([200, 503]).toContain(response.status);
    expect(body.data.checks).toHaveProperty('postgres');
    expect(body.data.checks).toHaveProperty('redis');
  });
});
