import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage, { generateMetadata as privacyMetadata } from "@/app/privacy/page";
import TermsPage, { generateMetadata as termsMetadata } from "@/app/terms/page";
import { metadata as deletionMetadata } from "@/app/delete-account/page";
import privacyAr from "../../../../mobile/src/features/legal/privacy.ar.json";
import privacyEn from "../../../../mobile/src/features/legal/privacy.en.json";
import termsAr from "../../../../mobile/src/features/legal/terms.ar.json";
import termsEn from "../../../../mobile/src/features/legal/terms.en.json";

it("brands deletion metadata for the public app and excludes inherited admin imagery", () => {
  expect(deletionMetadata.title).toBe("حذف حساب مصاريفي وراتبي | Delete your Masarifi & Ratibi account");
  expect(deletionMetadata.description).toContain("Masarifi & Ratibi");
  expect(deletionMetadata.openGraph?.title).toBe(deletionMetadata.title);
  expect(deletionMetadata.openGraph?.images).toEqual([]);
});

describe.each([
  { kind: "privacy", page: PrivacyPage, metadata: privacyMetadata, documents: { ar: privacyAr, en: privacyEn } },
  { kind: "terms", page: TermsPage, metadata: termsMetadata, documents: { ar: termsAr, en: termsEn } },
])("Public $kind document", ({ kind, page, metadata, documents }) => {
  it.each(["ar", "en"] as const)("server-renders every shared %s section without an account or client interaction", async (lang) => {
    const props = { searchParams: Promise.resolve({ lang }) };
    const element = document.createElement("div");
    element.innerHTML = renderToStaticMarkup(await page(props));
    const main = element.querySelector("main");
    expect(main?.getAttribute("lang")).toBe(lang);
    expect(main?.getAttribute("dir")).toBe(lang === "ar" ? "rtl" : "ltr");
    expect(main?.querySelector("h1")?.textContent).toBe(documents[lang].title);
    const sections = main!.querySelectorAll("article section");
    expect(sections).toHaveLength(documents[lang].sections.length);
    documents[lang].sections.forEach((section, index) => {
      expect(sections[index].id).toBe(section.id);
      expect(sections[index].querySelector("h2")?.textContent).toBe(section.title);
      expect(Array.from(sections[index].querySelectorAll("p"), (p) => p.textContent)).toEqual(section.paragraphs);
    });
    expect(main?.querySelector('input, button, form')).toBeNull();
    const alternate = lang === "ar" ? "en" : "ar";
    const languageLink = main!.querySelector<HTMLAnchorElement>(`a[hreflang="${alternate}"]`);
    expect(languageLink?.getAttribute("href")).toBe(`/${kind}?lang=${alternate}`);
    expect(languageLink?.textContent).toBe(lang === "ar" ? "English" : "العربية");
    expect(main?.querySelector('a[href="/delete-account"]')?.textContent).toBeTruthy();
    expect(main?.querySelector(`a[href="/${kind === "privacy" ? "terms" : "privacy"}?lang=${lang}"]`)?.textContent).toBeTruthy();
    expect(main?.querySelector('a[href="mailto:masarifi.ratibi@gmail.com"]')?.textContent).toContain("masarifi.ratibi@gmail.com");
    const meta = await metadata(props);
    expect(meta.title).toContain(documents[lang].title);
    expect(meta.title).toContain(lang === "ar" ? "مصاريفي وراتبي" : "Masarifi & Ratibi");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.images).toEqual([]);
  });
});

it.each([undefined, "fr", ["en", "ar"]])("defaults an absent or unsupported language %s to Arabic", async (lang) => {
  const html = renderToStaticMarkup(await PrivacyPage({ searchParams: Promise.resolve({ lang }) }));
  const element = document.createElement("div");
  element.innerHTML = html;
  expect(element.querySelector("main")?.lang).toBe("ar");
  expect(element.querySelector("h1")?.textContent).toBe("سياسة الخصوصية");
});
