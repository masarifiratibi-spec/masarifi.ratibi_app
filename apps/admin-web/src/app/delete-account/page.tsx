import type { Metadata } from "next";
import { DeletionPage } from "@/features/public-deletion/DeletionPage";
export const metadata: Metadata = {
  title: "حذف حساب مصاريفي | Delete your Masarifi account",
  description: "Request deletion of your Masarifi account and associated data.",
  robots: { index: true, follow: true },
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
