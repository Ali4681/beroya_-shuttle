import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ERROR_TABLE,
  collectErrorCodes,
  listOperations,
  type Doc,
} from './phase15-contract';

const DOCS = process.env.PHASE15_DOCS_URL ?? 'http://127.0.0.1:3001/api/v1/shuttle/docs-json';
const ROOT = join(__dirname, '..', '..');

function needlesFor(path: string): string[] {
  const values = new Set<string>([path]);
  if (path.startsWith('/api/v1/shuttle')) {
    values.add(path.slice('/api/v1/shuttle'.length) || '/');
  } else if (path !== '/health' && path !== '/metrics') {
    values.add(`/api/v1/shuttle${path}`);
  }
  return [...values];
}

async function main(): Promise<void> {
  const frontend = readFileSync(join(ROOT, 'FRONTEND_PLAN.md'), 'utf8');
  const mobile = readFileSync(join(ROOT, 'MOBILE_PLAN.md'), 'utf8');
  const combined = `${frontend}\n${mobile}`;

  const cached = join(__dirname, '.phase15', 'swagger.json');
  let doc: Doc;
  try {
    const response = await fetch(DOCS);
    if (!response.ok) {
      throw new Error(`docs-json HTTP ${response.status}`);
    }
    doc = (await response.json()) as Doc;
  } catch (error) {
    if (!existsSync(cached)) {
      throw error;
    }
    doc = JSON.parse(readFileSync(cached, 'utf8')) as Doc;
  }
  const ops = listOperations(doc);
  const missingPaths: string[] = [];
  for (const op of ops) {
    const found = needlesFor(op.path).some((needle) => combined.includes(needle));
    if (!found) {
      missingPaths.push(`${op.method} ${op.path}`);
    }
  }

  const codes = new Set([
    ...collectErrorCodes(join(__dirname, '..', 'src')),
    ...ERROR_TABLE.map((row) => row[0]),
  ]);
  const missingCodes = [...codes].filter((code) => !combined.includes(code));

  if (missingPaths.length || missingCodes.length) {
    const sample = [
      ...missingPaths.slice(0, 12).map((row) => `path ${row}`),
      ...missingCodes.slice(0, 12).map((row) => `code ${row}`),
    ].join('\n');
    throw new Error(
      `Phase 15 contract gaps: ${missingPaths.length} paths, ${missingCodes.length} codes\n${sample}`,
    );
  }

  if (!frontend.includes('next-intl') || !frontend.includes('(admin)')) {
    throw new Error('FRONTEND_PLAN.md missing required stack or route groups');
  }
  if (!mobile.includes('Foreground Service') || !mobile.includes('location/batch')) {
    throw new Error('MOBILE_PLAN.md missing background GPS or offline batch');
  }

  console.log(
    `Phase 15 verified — ${ops.length} swagger operations and ${codes.size} error codes covered in FRONTEND_PLAN.md + MOBILE_PLAN.md`,
  );
}

main().catch((error: unknown) => {
  console.error(`Phase 15 verify failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
