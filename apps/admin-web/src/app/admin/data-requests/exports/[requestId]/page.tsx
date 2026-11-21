import { ErrorState } from "@/components/admin/ui";
import { securityDetailIdSchema } from "@/features/security/contracts";
import { ExportDetailRoute } from "@/features/security/PrivacyViews";

export default async function ExportRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const parsed = securityDetailIdSchema("EXP").safeParse(requestId);
  return parsed.success ? <ExportDetailRoute requestId={parsed.data} /> : <ErrorState />;
}
