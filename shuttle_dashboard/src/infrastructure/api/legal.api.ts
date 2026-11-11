import { keysToCamel } from "@/infrastructure/http/case";
import { http } from "@/infrastructure/http/client";

export type LegalDocumentKey = "privacy_policy" | "terms_of_use";
export type LegalSlug = "privacy-policy" | "terms-of-use";

export type LegalDocument = {
  key: LegalDocumentKey;
  version: string;
  updatedAt: string;
  locale: "ar" | "en";
  title: string;
  contentMarkdown: string;
  contentHtml: string;
};

const PATHS: Record<LegalSlug, string> = {
  "privacy-policy": "/public/legal/privacy-policy",
  "terms-of-use": "/public/legal/terms-of-use",
};

function backendBase() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

export const legalApi = {
  get(slug: LegalSlug, locale?: string) {
    return http.getPublic<LegalDocument>(PATHS[slug], { locale });
  },
};

/** Server-side fetch for legal pages (SSR / metadata). */
export async function fetchLegalDocument(
  slug: LegalSlug,
  locale: string,
): Promise<LegalDocument | null> {
  try {
    const response = await fetch(
      `${backendBase()}/api/v1/shuttle/public/legal/${slug}?locale=${encodeURIComponent(locale)}`,
      {
        headers: {
          Accept: "application/json",
          "X-Locale": locale,
          "Accept-Language": locale,
        },
        // Legal copy is edited in the API; avoid serving a stale cached document.
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = keysToCamel<{ data: LegalDocument }>(await response.json());
    return payload?.data ?? null;
  } catch {
    return null;
  }
}
