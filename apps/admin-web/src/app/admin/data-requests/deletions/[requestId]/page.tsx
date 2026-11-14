import { ErrorState } from "@/components/admin/ui";
import { securityDetailIdSchema } from "@/features/security/contracts";
import { DeletionDetailRoute } from "@/features/security/PrivacyViews";

export default async function DeletionRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const parsed = securityDetailIdSchema("DEL").safeParse(requestId);
  return parsed.success ? <DeletionDetailRoute requestId={parsed.data} /> : <ErrorState />;
}
