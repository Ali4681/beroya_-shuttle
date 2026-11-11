import { OpenAPIObject } from '@nestjs/swagger';

const COMMON_ERRORS = {
  '400': {
    description: 'VALIDATION_ERROR | domain bad request (`error.code`)',
  },
  '401': { description: 'UNAUTHORIZED | SESSION_REVOKED' },
  '403': { description: 'FORBIDDEN | TENANT_REQUIRED | role mismatch' },
  '404': { description: 'Resource not found (`error.code`)' },
  '409': { description: 'Conflict (`error.code`)' },
  '429': { description: 'RATE_LIMITED' },
};

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

export function applySwaggerContract(document: OpenAPIObject): OpenAPIObject {
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    if (!methods || typeof methods !== 'object') {
      continue;
    }
    for (const [method, operation] of Object.entries(methods)) {
      if (
        !HTTP_METHODS.has(method) ||
        !operation ||
        typeof operation !== 'object'
      ) {
        continue;
      }
      const op = operation as {
        summary?: string;
        responses?: Record<string, unknown>;
      };
      if (!op.summary) {
        op.summary = `${method.toUpperCase()} ${path}`;
      }
      op.responses ??= {};
      for (const [status, spec] of Object.entries(COMMON_ERRORS)) {
        if (!op.responses[status]) {
          op.responses[status] = spec;
        }
      }
    }
  }
  return document;
}

export function assertSwaggerContract(document: {
  paths?: Record<
    string,
    Record<string, { summary?: string; responses?: unknown }>
  >;
}): string[] {
  const missing: string[] = [];
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      if (
        !HTTP_METHODS.has(method) ||
        !operation ||
        typeof operation !== 'object'
      ) {
        continue;
      }
      if (!operation.summary) {
        missing.push(`${method.toUpperCase()} ${path} missing summary`);
      }
      const responses = operation.responses;
      if (
        !responses ||
        typeof responses !== 'object' ||
        Object.keys(responses).length === 0
      ) {
        missing.push(`${method.toUpperCase()} ${path} missing responses`);
      }
    }
  }
  return missing;
}
