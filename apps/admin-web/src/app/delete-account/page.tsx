import type { Metadata } from "next";
import { DeletionPage } from "@/features/public-deletion/DeletionPage";
export const metadata: Metadata = {
  title: "حذف حساب مصاريفي وراتبي | Delete your Masarifi & Ratibi account",
  description: "Request deletion of your Masarifi & Ratibi account and associated data.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "حذف حساب مصاريفي وراتبي | Delete your Masarifi & Ratibi account",
    description: "Request deletion of your Masarifi & Ratibi account and associated data.",
    siteName: "مصاريفي وراتبي | Masarifi & Ratibi",
    images: [],
  },
};
export default function Page() {
  return (
    <DeletionPage
      enabled={Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.NEXT_PUBLIC_API_URL,
      )}
    />
  );
}
