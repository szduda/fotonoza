import type { Lang } from "@/lib/i18n";

export const SUPPORTED_LOCALES: Lang[] = ["en", "pl"];

export function isSupportedLocale(value: string | undefined): value is Lang {
  return value === "en" || value === "pl";
}

export function otherLocale(locale: Lang): Lang {
  return locale === "en" ? "pl" : "en";
}

/** Home with trailing slash, e.g. `/en/` */
export function homePath(locale: Lang): string {
  return `/${locale}/`;
}

/**
 * Same URL path with a different locale prefix, e.g. `/en/news/foo/` → `/pl/news/foo/`.
 * If there is nothing after the locale segment, returns the target locale home.
 */
export function switchLocalePath(pathname: string, targetLocale: Lang): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return homePath(targetLocale);
  const [first, ...rest] = segments;
  if (first !== "en" && first !== "pl") return homePath(targetLocale);
  if (rest.length === 0) return homePath(targetLocale);
  return `/${targetLocale}/${rest.join("/")}/`;
}

/** News index with trailing slash */
export function newsIndexPath(locale: Lang): string {
  return `/${locale}/news/`;
}

/** Single news article with trailing slash */
export function newsArticlePath(locale: Lang, id: string): string {
  return `/${locale}/news/${id}/`;
}

/** Content `id` is like `en/progress-…`; URL uses the filename stem only. */
export function newsStorySlugFromEntryId(entryId: string): string {
  const normalized = entryId.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i >= 0 ? normalized.slice(i + 1) : normalized;
}
