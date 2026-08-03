import { ErrorState } from "@/components/admin/ui";
import { securityIdSchema } from "@/features/security/contracts";
import { AuditEventDetailRoute } from "@/features/security/AuditViews";

export default async function AuditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const parsed = securityIdSchema.safeParse(eventId);
  return parsed.success && parsed.data.startsWith("AUD-") ? <AuditEventDetailRoute eventId={parsed.data} /> : <ErrorState />;
}
