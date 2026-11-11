import {
  applySwaggerContract,
  assertSwaggerContract,
} from './swagger-contract';

describe('swagger contract', () => {
  it('adds shared error responses', () => {
    const document = applySwaggerContract({
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/x': {
          get: { summary: 'X', responses: { '200': { description: 'ok' } } },
        },
      },
    });
    const get = document.paths['/x']?.get;
    expect(get?.responses?.['401']).toBeTruthy();
    expect(get?.responses?.['429']).toBeTruthy();
  });

  it('flags operations without a summary', () => {
    const missing = assertSwaggerContract({
      paths: {
        '/y': { get: { responses: { '200': { description: 'ok' } } } },
      },
    });
    expect(missing[0]).toContain('missing summary');
  });

  it('skips non-operations and fills a default summary', () => {
    const document = applySwaggerContract({
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/z': undefined as never,
        '/w': {
          parameters: [] as never,
          post: { responses: { '201': { description: 'created' } } },
        },
      },
    });
    expect(document.paths['/w']?.post?.summary).toBe('POST /w');
    expect(
      assertSwaggerContract({
        paths: {
          '/n': { get: { summary: 'N' } },
          '/p': { parameters: [] as never },
        },
      })[0],
    ).toContain('missing responses');
  });
});
