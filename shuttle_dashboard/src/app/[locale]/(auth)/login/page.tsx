import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginView } from "@/presentation/components/auth/login-view";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  const tApp = await getTranslations({ locale, namespace: "App" });

  return {
    title: `${t("metaTitle")} · ${tApp("name")}`,
  };
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LoginView year={new Date().getFullYear()} />;
}
