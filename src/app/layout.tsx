import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://masarifi-admin-prototype.sites.openai.com"),
  title: "مساريفي | لوحة الإدارة",
  description: "نموذج عرض تشغيلي لمنصة مساريفي",
  openGraph: {
    title: "مساريفي | لوحة الإدارة",
    description: "نموذج عرض تشغيلي عربي لمنصة مساريفي",
    images: [{ url: "/og.png", width: 1673, height: 941, alt: "مساريفي — لوحة الإدارة" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
