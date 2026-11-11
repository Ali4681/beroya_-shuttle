function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function toSnakeCase(key: string): string {
  return key
    .replace(/([A-Z])/g, '_$1')
    .replace(/-([a-z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function toCamelCase(key: string): string {
  return key.replace(/[_-]([a-z0-9])/g, (_, char: string) =>
    char.toUpperCase(),
  );
}

function transformKeys(
  input: unknown,
  convertKey: (key: string) => string,
): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => transformKeys(item, convertKey));
  }

  if (input instanceof Date || input instanceof Buffer) {
    return input;
  }

  if (!isPlainObject(input)) {
    return input;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[convertKey(key)] = transformKeys(value, convertKey);
  }
  return output;
}

export function keysToSnakeCase<T>(input: T): T {
  return transformKeys(input, toSnakeCase) as T;
}

export function keysToCamelCase<T>(input: T): T {
  return transformKeys(input, toCamelCase) as T;
}
