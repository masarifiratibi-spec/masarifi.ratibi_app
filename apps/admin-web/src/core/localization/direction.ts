import type { z } from "zod";
import { localeSchema } from "@/core/validation/common";

export type Locale = z.infer<typeof localeSchema>;
export type Direction = "rtl" | "ltr";

export function directionForLocale(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = directionForLocale(locale);
}
