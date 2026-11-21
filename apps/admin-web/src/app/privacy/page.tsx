import {
  createLegalMetadata,
  PublicLegalPage,
  resolveLegalLanguage,
  type LegalPageProps,
} from "@/features/public-legal/PublicLegalPage";

export async function generateMetadata({ searchParams }: LegalPageProps) {
  return createLegalMetadata("privacy", resolveLegalLanguage(await searchParams));
}

export default async function Page({ searchParams }: LegalPageProps) {
  return <PublicLegalPage kind="privacy" language={resolveLegalLanguage(await searchParams)} />;
}
