import { ErrorState } from "@/components/admin/ui";
import { securityDetailIdSchema } from "@/features/security/contracts";
import { AuditEventDetailRoute } from "@/features/security/AuditViews";

export default async function AuditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const parsed = securityDetailIdSchema("AUD").safeParse(eventId);
  return parsed.success ? <AuditEventDetailRoute eventId={parsed.data} /> : <ErrorState />;
}
