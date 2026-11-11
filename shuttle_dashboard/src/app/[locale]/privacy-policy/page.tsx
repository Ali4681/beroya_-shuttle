import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchLegalDocument } from "@/infrastructure/api/legal.api";
import {
  formatLegalDate,
  LegalDocumentView,
} from "@/presentation/components/legal/legal-document-view";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const doc = await fetchLegalDocument("privacy-policy", locale);
  const tApp = await getTranslations({ locale, namespace: "App" });

  return {
    title: `${doc?.title ?? "Privacy Policy"} · ${tApp("name")}`,
    description: doc?.title,
  };
}

export default async function PrivacyPolicyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [doc, t] = await Promise.all([
    fetchLegalDocument("privacy-policy", locale),
    getTranslations({ locale, namespace: "Legal" }),
  ]);

  return (
    <LegalDocumentView
      document={doc}
      otherSlug="terms-of-use"
      labels={{
        otherTitle: t("termsOfUse"),
        backHome: t("backHome"),
        version: t("version", { version: doc?.version ?? "—" }),
        updated: t("updated", { date: formatLegalDate(doc?.updatedAt, locale) }),
        errorTitle: t("errorTitle"),
        errorLead: t("errorLead"),
      }}
    />
  );
}
