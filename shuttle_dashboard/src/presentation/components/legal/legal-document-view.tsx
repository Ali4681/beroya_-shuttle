import { ArrowLeft, DocumentText } from "iconsax-react-v2";
import { Link } from "@/i18n/navigation";
import type { LegalDocument, LegalSlug } from "@/infrastructure/api/legal.api";
import { BrandLockup } from "@/presentation/components/brand/brand-logo";
import { LanguageSwitcher } from "@/presentation/components/layout/language-switcher";
import { ThemeToggle } from "@/presentation/components/theme/theme-toggle";

type LegalDocumentViewProps = {
  document: LegalDocument | null;
  otherSlug: LegalSlug;
  labels: {
    otherTitle: string;
    backHome: string;
    version: string;
    updated: string;
    errorTitle: string;
    errorLead: string;
  };
};

export function formatLegalDate(value: string | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function LegalDocumentView({
  document,
  otherSlug,
  labels,
}: LegalDocumentViewProps) {
  return (
    <main className="legal-stage relative min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
      <div className="legal-backdrop" aria-hidden>
        <span className="legal-glow legal-glow--1" />
        <span className="legal-glow legal-glow--2" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-16 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <nav className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-text-secondary no-underline transition-colors hover:text-accent-strong"
          >
            <span className="inline-flex rtl:rotate-180" aria-hidden>
              <ArrowLeft size={16} color="currentColor" variant="Linear" />
            </span>
            {labels.backHome}
          </Link>
          <span className="text-border-strong" aria-hidden>
            ·
          </span>
          <Link
            href={`/${otherSlug}`}
            className="text-text-secondary no-underline transition-colors hover:text-accent-strong"
          >
            {labels.otherTitle}
          </Link>
        </nav>

        {document ? (
          <article className="legal-sheet mt-6">
            <div className="legal-sheet-head">
              <span className="legal-sheet-icon" aria-hidden>
                <DocumentText size={22} color="currentColor" variant="Bold" />
              </span>
              <div className="min-w-0">
                <h1 className="legal-sheet-title">{document.title}</h1>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-muted">
                  <span>{labels.version}</span>
                  <span aria-hidden>·</span>
                  <span>{labels.updated}</span>
                </p>
              </div>
            </div>

            <div
              className="legal-prose"
              dangerouslySetInnerHTML={{ __html: document.contentHtml }}
            />
          </article>
        ) : (
          <div className="legal-sheet mt-6 text-center">
            <h1 className="legal-sheet-title">{labels.errorTitle}</h1>
            <p className="mt-3 text-text-secondary">{labels.errorLead}</p>
            <Link
              href="/"
              className="mt-6 inline-flex text-accent-strong no-underline hover:underline"
            >
              {labels.backHome}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
