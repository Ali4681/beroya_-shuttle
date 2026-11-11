import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

function deepMerge(base: Messages, extra: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] =
      typeof value === "object" && typeof current === "object"
        ? deepMerge(current, value)
        : value;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [base, panel] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/${locale}.panel.json`),
  ]);

  return {
    locale,
    messages: deepMerge(base.default as Messages, panel.default as Messages),
  };
});
