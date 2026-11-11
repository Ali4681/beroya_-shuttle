import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LandingView } from "@/presentation/components/landing/landing-view";
import {
  ROLE_COOKIE,
  SESSION_COOKIE,
  homePathForRole,
  isPanelRole,
} from "@/shared/lib/session";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing.meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  const signedIn = cookieStore.has(SESSION_COOKIE) && isPanelRole(role);

  return (
    <LandingView
      year={new Date().getFullYear()}
      dashboardHref={signedIn ? homePathForRole(role) : "/login"}
      signedIn={signedIn}
    />
  );
}
