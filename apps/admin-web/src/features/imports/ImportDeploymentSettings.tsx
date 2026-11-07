"use client";
import { PageHeader } from "@/components/admin/ui";
import { useLocale } from "@/core/localization/provider";
export function ImportDeploymentSettings() {
  const { locale } = useLocale();
  return (
    <section className="page">
      <PageHeader
        title={locale === "ar" ? "إعدادات الاستيراد" : "Import settings"}
        description={
          locale === "ar"
            ? "تُدار حدود الملفات والاحتفاظ وإعدادات المحلل من إعدادات النشر. هذه الصفحة للقراءة فقط ولا تحفظ تغييرات."
            : "File limits, retention and parser runtime settings are managed through deployment configuration. This page is read-only and does not save changes."
        }
      />
    </section>
  );
}
