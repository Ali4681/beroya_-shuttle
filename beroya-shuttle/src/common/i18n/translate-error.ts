import { ERROR_CATALOG, type AppLocale } from './error-catalog';

const KNOWN_ENGLISH: Record<string, string> = {
  'Email and password are required': 'EMAIL_PASSWORD_REQUIRED',
  'to must be on or after from': 'INVALID_DATE_RANGE',
  'Validation failed': 'VALIDATION_ERROR',
  'Internal server error': 'INTERNAL_ERROR',
};

const CONSTRAINTS: Record<AppLocale, Record<string, string>> = {
  en: {
    isEmail: '{field} must be a valid email',
    isString: '{field} must be text',
    isNotEmpty: '{field} is required',
    isInt: '{field} must be a whole number',
    isNumber: '{field} must be a number',
    isBoolean: '{field} must be true or false',
    isUuid: '{field} must be a valid id',
    isEnum: '{field} has an invalid value',
    isDateString: '{field} must be a valid date',
    matches: '{field} has an invalid format',
    minLength: '{field} is too short',
    maxLength: '{field} is too long',
    min: '{field} is below the minimum',
    max: '{field} is above the maximum',
    arrayMinSize: '{field} has too few items',
    arrayMaxSize: '{field} has too many items',
    whitelist: '{field} is not allowed',
    nestedValidation: '{field} is invalid',
  },
  ar: {
    isEmail: '{field} يجب أن يكون بريداً صالحاً',
    isString: '{field} يجب أن يكون نصاً',
    isNotEmpty: '{field} مطلوب',
    isInt: '{field} يجب أن يكون رقماً صحيحاً',
    isNumber: '{field} يجب أن يكون رقماً',
    isBoolean: '{field} يجب أن يكون نعم أو لا',
    isUuid: '{field} يجب أن يكون معرّفاً صالحاً',
    isEnum: '{field} قيمته غير صالحة',
    isDateString: '{field} يجب أن يكون تاريخاً صالحاً',
    matches: '{field} بتنسيق غير صالح',
    minLength: '{field} أقصر من الحد المسموح',
    maxLength: '{field} أطول من الحد المسموح',
    min: '{field} أقل من الحد الأدنى',
    max: '{field} أكبر من الحد الأعلى',
    arrayMinSize: '{field} فيه عناصر أقل من المطلوب',
    arrayMaxSize: '{field} فيه عناصر أكثر من المسموح',
    whitelist: '{field} غير مسموح',
    nestedValidation: '{field} غير صالح',
  },
};

const ENGLISH_HINTS: Array<[RegExp, string]> = [
  [/must be an email/i, 'isEmail'],
  [/must be a string/i, 'isString'],
  [/should not be empty/i, 'isNotEmpty'],
  [/must be an integer/i, 'isInt'],
  [/must be a number/i, 'isNumber'],
  [/must be a boolean/i, 'isBoolean'],
  [/must be a UUID/i, 'isUuid'],
  [/must be one of the following values/i, 'isEnum'],
  [/must be a valid ISO 8601 date/i, 'isDateString'],
  [/must be a valid phone number/i, 'matches'],
  [/must match /i, 'matches'],
  [/must be longer than or equal to/i, 'minLength'],
  [/must be shorter than or equal to/i, 'maxLength'],
  [/must not be less than/i, 'min'],
  [/must not be greater than/i, 'max'],
  [/must contain (at least|no fewer)/i, 'arrayMinSize'],
  [/must contain (not more|no more)/i, 'arrayMaxSize'],
  [/should not exist/i, 'whitelist'],
  [/nested property/i, 'nestedValidation'],
];

export function translateError(
  code: string | undefined,
  fallback: string | undefined,
  locale: AppLocale,
): string {
  if (code && ERROR_CATALOG[code]) return ERROR_CATALOG[code][locale];
  if (fallback && KNOWN_ENGLISH[fallback] && ERROR_CATALOG[KNOWN_ENGLISH[fallback]]) {
    return ERROR_CATALOG[KNOWN_ENGLISH[fallback]][locale];
  }
  if (fallback?.trim()) return fallback;
  return ERROR_CATALOG.INTERNAL_ERROR[locale];
}

export function translateValidationMessage(message: string, locale: AppLocale): string {
  const knownCode = KNOWN_ENGLISH[message];
  if (knownCode) return translateError(knownCode, message, locale);

  const field = message.split(' ')[0] ?? '';
  for (const [pattern, constraint] of ENGLISH_HINTS) {
    if (!pattern.test(message)) continue;
    const template = CONSTRAINTS[locale][constraint];
    if (template) return template.replace('{field}', field);
  }
  if (locale === 'en') return message;
  return ERROR_CATALOG.VALIDATION_ERROR.ar;
}
