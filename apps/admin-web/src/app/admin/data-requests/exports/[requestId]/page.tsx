import { ErrorState } from "@/components/admin/ui";
import { securityIdSchema } from "@/features/security/contracts";
import { ExportDetailRoute } from "@/features/security/PrivacyViews";

export default async function ExportRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const parsed = securityIdSchema.safeParse(requestId);
  return parsed.success && parsed.data.startsWith("EXP-") ? <ExportDetailRoute requestId={parsed.data} /> : <ErrorState />;
}
