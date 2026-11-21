import {
  createLegalMetadata,
  PublicLegalPage,
  resolveLegalLanguage,
  type LegalPageProps,
} from "@/features/public-legal/PublicLegalPage";

export async function generateMetadata({ searchParams }: LegalPageProps) {
  return createLegalMetadata("terms", resolveLegalLanguage(await searchParams));
}

export default async function Page({ searchParams }: LegalPageProps) {
  return <PublicLegalPage kind="terms" language={resolveLegalLanguage(await searchParams)} />;
}
