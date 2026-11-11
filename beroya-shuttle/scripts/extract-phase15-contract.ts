import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE =
  process.env.PHASE15_DOCS_URL ?? 'http://127.0.0.1:3001/api/v1/shuttle/docs-json';

type Operation = {
  summary?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: { type?: string; format?: string; enum?: string[] };
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<string, { description?: string; content?: unknown }>;
  security?: unknown[];
};

type Doc = {
  paths?: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, unknown> };
};

function audienceFor(path: string): 'frontend' | 'mobile' | 'both' {
  const p = path.replace(/^\/api\/v1\/shuttle/, '') || path;
  if (
    p.startsWith('/auth') ||
    p === '/health' ||
    p.endsWith('/health')
  ) {
    return 'both';
  }
  if (
    p.startsWith('/driver') ||
    p.startsWith('/attendant') ||
    p.startsWith('/parent') ||
    p.startsWith('/university')
  ) {
    return 'mobile';
  }
  return 'frontend';
}

function extractErrorCodes(root: string): string[] {
  const { execSync } = require('child_process') as typeof import('child_process');
  const out = execSync(
    'rg -o --no-filename "\'[A-Z][A-Z0-9_]{2,}\'" src',
    { cwd: root, encoding: 'utf8' },
  );
  const codes = new Set<string>();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/'([A-Z][A-Z0-9_]{2,})'/);
    if (m) {
      codes.add(m[1]);
    }
  }
  const known = [
    'UNAUTHORIZED',
    'SESSION_REVOKED',
    'FORBIDDEN',
    'TENANT_REQUIRED',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
    'ROOM_FORBIDDEN',
  ];
  for (const code of known) {
    codes.add(code);
  }
  return [...codes].sort();
}

async function main(): Promise<void> {
  const root = join(__dirname, '..');
  const response = await fetch(BASE);
  if (!response.ok) {
    throw new Error(`docs-json HTTP ${response.status}`);
  }
  const doc = (await response.json()) as Doc;
  const operations: Array<{
    method: string;
    path: string;
    summary: string;
    audience: ReturnType<typeof audienceFor>;
    tags: string[];
    operation: Operation;
  }> = [];
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        continue;
      }
      operations.push({
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? `${method.toUpperCase()} ${path}`,
        audience: audienceFor(path),
        tags: operation.tags ?? [],
        operation,
      });
    }
  }
  operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  let codes: string[] = [];
  try {
    codes = extractErrorCodes(root);
  } catch {
    codes = [];
  }

  const outDir = join(root, 'scripts', '.phase15');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'swagger.json'),
    JSON.stringify(doc, null, 2),
    'utf8',
  );
  writeFileSync(
    join(outDir, 'operations.json'),
    JSON.stringify(operations, null, 2),
    'utf8',
  );
  writeFileSync(join(outDir, 'error-codes.json'), JSON.stringify(codes, null, 2), 'utf8');
  console.log(
    `extracted ${operations.length} operations, ${codes.length} candidate codes`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
