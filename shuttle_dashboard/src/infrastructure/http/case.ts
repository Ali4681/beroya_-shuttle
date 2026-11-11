function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function transformKeys(input: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(input)) return input.map((item) => transformKeys(item, convert));
  if (!isPlainObject(input)) return input;

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[convert(key)] = transformKeys(value, convert);
  }
  return output;
}

export function snakeToCamel(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function camelToSnake(key: string) {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function keysToCamel<T = unknown>(input: unknown): T {
  return transformKeys(input, snakeToCamel) as T;
}

export function keysToSnake<T = unknown>(input: unknown): T {
  return transformKeys(input, camelToSnake) as T;
}

/**
 * The backend snake-cases every response key, which turns enum-valued keys
 * such as `ACTIVE` into `a_c_t_i_v_e`; after camelizing they read `aCTIVE`.
 * Upper-casing restores the original enum value.
 */
export function enumKeys(record: Record<string, number> | null | undefined) {
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    output[key.toUpperCase()] = value;
  }
  return output;
}
