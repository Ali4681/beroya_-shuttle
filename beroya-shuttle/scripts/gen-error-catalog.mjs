import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const ar = JSON.parse(
  fs.readFileSync(path.join(root, "shuttle_dashboard/messages/ar.panel.json"), "utf8"),
).Errors;
const en = JSON.parse(
  fs.readFileSync(path.join(root, "shuttle_dashboard/messages/en.panel.json"), "utf8"),
).Errors;

const extras = {
  EMAIL_PASSWORD_REQUIRED: {
    ar: "البريد وكلمة السر مطلوبان، وكلمة السر 8 أحرف على الأقل",
    en: "Email and password are required, and the password must be at least 8 characters",
  },
  INVALID_DATE_RANGE: {
    ar: "تاريخ النهاية يجب أن يكون في نفس يوم البداية أو بعده",
    en: "The end date must be on or after the start date",
  },
};

function esc(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const keys = [...new Set([...Object.keys(ar), ...Object.keys(en), ...Object.keys(extras)])].sort();
const lines = [
  "export type AppLocale = 'ar' | 'en';",
  "",
  "export const ERROR_CATALOG: Record<string, Record<AppLocale, string>> = {",
];

for (const key of keys) {
  const arabic = extras[key]?.ar ?? ar[key] ?? en[key] ?? key;
  const english = extras[key]?.en ?? en[key] ?? ar[key] ?? key;
  lines.push(`  ${key}: { ar: '${esc(arabic)}', en: '${esc(english)}' },`);
}

lines.push("};", "");
const out = path.join(import.meta.dirname, "../src/common/i18n/error-catalog.ts");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"));
console.log(`wrote ${keys.length} codes`);
