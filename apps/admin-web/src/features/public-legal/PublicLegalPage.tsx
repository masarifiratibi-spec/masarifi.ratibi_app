import type { Metadata } from "next";
import privacyAr from "../../../../mobile/src/features/legal/privacy.ar.json";
import privacyEn from "../../../../mobile/src/features/legal/privacy.en.json";
import termsAr from "../../../../mobile/src/features/legal/terms.ar.json";
import termsEn from "../../../../mobile/src/features/legal/terms.en.json";
import styles from "./legal.module.css";

type LegalLanguage = "ar" | "en";
type LegalKind = "privacy" | "terms";
type SearchParams = { [key: string]: string | string[] | undefined };
export type LegalPageProps = { searchParams: Promise<SearchParams> };

const documents = {
  ar: { privacy: privacyAr, terms: termsAr },
  en: { privacy: privacyEn, terms: termsEn },
};
const copy = {
  ar: {
    brand: "مصاريفي وراتبي",
    language: "English",
    skip: "انتقل إلى المستند",
    contents: "محتويات المستند",
    legal: "معلومات قانونية وتواصل",
    privacy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    deletion: "طلب حذف الحساب والبيانات",
    contact: "للاستفسارات المتعلقة بالخصوصية أو الدعم:",
    description: "سياسة الخصوصية والشروط وحقوق البيانات ووسائل التواصل لتطبيق مصاريفي وراتبي.",
  },
  en: {
    brand: "Masarifi & Ratibi",
    language: "العربية",
    skip: "Skip to the document",
    contents: "Document contents",
    legal: "Legal information and contact",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    deletion: "Request account and data deletion",
    contact: "For privacy or support enquiries:",
    description: "Privacy, terms, data rights and contact information for Masarifi & Ratibi.",
  },
};

export function resolveLegalLanguage(params: SearchParams): LegalLanguage {
  return params.lang === "en" ? "en" : "ar";
}

export function createLegalMetadata(kind: LegalKind, language: LegalLanguage): Metadata {
  const text = copy[language];
  const title = `${documents[language][kind].title} | ${text.brand}`;
  return {
    title,
    description: text.description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description: text.description,
      siteName: text.brand,
      locale: language === "ar" ? "ar_SA" : "en_US",
      type: "website",
      images: [],
    },
  };
}

export function PublicLegalPage({ kind, language }: { kind: LegalKind; language: LegalLanguage }) {
  const document = documents[language][kind];
  const text = copy[language];
  const alternate = language === "ar" ? "en" : "ar";
  return (
    <main className={styles.page} lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
      <a className={styles.skip} href="#legal-document">{text.skip}</a>
      <div className={styles.container}>
        <header className={styles.header}>
          <span>مصاريفي وراتبي · Masarifi &amp; Ratibi</span>
          <a href={`/${kind}?lang=${alternate}`} hrefLang={alternate} lang={alternate}>
            {text.language}
          </a>
        </header>
        <h1>{document.title}</h1>
        <nav className={styles.contents} aria-label={text.contents}>
          <ol>
            {document.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
            ))}
          </ol>
        </nav>
        <article id="legal-document" tabIndex={-1}>
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
              <h2 id={`${section.id}-heading`}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </article>
        <footer className={styles.footer}>
          <nav aria-label={text.legal}>
            <a href={`/privacy?lang=${language}`} aria-current={kind === "privacy" ? "page" : undefined}>{text.privacy}</a>
            <a href={`/terms?lang=${language}`} aria-current={kind === "terms" ? "page" : undefined}>{text.terms}</a>
            <a href="/delete-account">{text.deletion}</a>
          </nav>
          <p>{text.contact} <a href="mailto:masarifi.ratibi@gmail.com"><bdi>masarifi.ratibi@gmail.com</bdi></a></p>
        </footer>
      </div>
    </main>
  );
}
