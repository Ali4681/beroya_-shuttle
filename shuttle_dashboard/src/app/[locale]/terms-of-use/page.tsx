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
  const doc = await fetchLegalDocument("terms-of-use", locale);
  const tApp = await getTranslations({ locale, namespace: "App" });

  return {
    title: `${doc?.title ?? "Terms of Use"} · ${tApp("name")}`,
    description: doc?.title,
  };
}

export default async function TermsOfUsePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [doc, t] = await Promise.all([
    fetchLegalDocument("terms-of-use", locale),
    getTranslations({ locale, namespace: "Legal" }),
  ]);

  return (
    <LegalDocumentView
      document={doc}
      otherSlug="privacy-policy"
      labels={{
        otherTitle: t("privacyPolicy"),
        backHome: t("backHome"),
        version: t("version", { version: doc?.version ?? "—" }),
        updated: t("updated", { date: formatLegalDate(doc?.updatedAt, locale) }),
        errorTitle: t("errorTitle"),
        errorLead: t("errorLead"),
      }}
    />
  );
}
