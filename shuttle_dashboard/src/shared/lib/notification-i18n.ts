export type LocalizedNotice = { title: string; body: string };

const TITLE_SEP = " / ";
const BODY_SEP = "\n\n—\n\n";

function filled(text: LocalizedNotice) {
  return text.title.trim().length >= 2 && text.body.trim().length >= 2;
}

/** Packs both languages into the single title/body the backend accepts. Arabic first. */
export function combineNotificationLocales(ar: LocalizedNotice, en: LocalizedNotice): LocalizedNotice {
  const arabic = { title: ar.title.trim(), body: ar.body.trim() };
  const english = { title: en.title.trim(), body: en.body.trim() };
  const hasAr = filled(arabic);
  const hasEn = filled(english);
  if (hasAr && hasEn) {
    return {
      title: `${arabic.title}${TITLE_SEP}${english.title}`,
      body: `${arabic.body}${BODY_SEP}${english.body}`,
    };
  }
  return hasAr ? arabic : english;
}

/** Picks the matching language from a packed title/body. Falls back to the other, then the raw text. */
export function pickNotificationLocale(title: string, body: string, locale: string): LocalizedNotice {
  const titles = title.split(TITLE_SEP);
  const bodies = body.split(BODY_SEP);
  if (titles.length !== 2 || bodies.length !== 2) return { title, body };
  const arabic = { title: titles[0].trim(), body: bodies[0].trim() };
  const english = { title: titles[1].trim(), body: bodies[1].trim() };
  return locale === "en" ? english : arabic;
}
