import { ErrorState } from "@/components/admin/ui";
import { securityIdSchema } from "@/features/security/contracts";
import { DeletionDetailRoute } from "@/features/security/PrivacyViews";

export default async function DeletionRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const parsed = securityIdSchema.safeParse(requestId);
  return parsed.success && parsed.data.startsWith("DEL-") ? <DeletionDetailRoute requestId={parsed.data} /> : <ErrorState />;
}
