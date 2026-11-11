import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LocaleTransitionShell } from "@/presentation/components/layout/locale-transition-shell";
import { ThemeBootScript } from "@/presentation/components/theme/theme-boot-script";
import { ThemeProvider } from "@/presentation/components/theme/theme-provider";
import { AppProviders } from "@/presentation/providers/app-providers";
import { getLocaleDirection, routing } from "@/i18n/routing";
import { BRAND_FAVICON } from "@/shared/brand-assets";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "App" });

  return {
    title: t("name"),
    description: t("description"),
    icons: {
      icon: [{ url: BRAND_FAVICON, type: "image/svg+xml" }],
      apple: [{ url: BRAND_FAVICON, type: "image/svg+xml" }],
      shortcut: BRAND_FAVICON,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = getLocaleDirection(locale);

  return (
    <html
      lang={locale}
      dir={direction}
      suppressHydrationWarning
      className={`${cairo.variable} h-full overflow-hidden antialiased`}
    >
      <head>
        <ThemeBootScript />
      </head>
      {/* Browser extensions (e.g. ColorZilla's `cz-shortcut-listen`) add attributes to <body> before hydration. */}
      <body suppressHydrationWarning className="flex h-dvh overflow-hidden bg-background font-sans text-foreground">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AppProviders>
              <LocaleTransitionShell>{children}</LocaleTransitionShell>
            </AppProviders>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
