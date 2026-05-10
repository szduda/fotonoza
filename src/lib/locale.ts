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

/** News index with trailing slash */
export function newsIndexPath(locale: Lang): string {
  return `/${locale}/news/`;
}

/** Single news article with trailing slash */
export function newsArticlePath(locale: Lang, id: string): string {
  return `/${locale}/news/${id}/`;
}
