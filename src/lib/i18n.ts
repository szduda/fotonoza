import en from "@/i18n/en.json";
import pl from "@/i18n/pl.json";

export type Lang = "en" | "pl";

export const translations = {
  en,
  pl
} as const;

export type Messages = (typeof translations)["en"];

export function getMessages(lang: Lang): Messages {
  return translations[lang];
}
