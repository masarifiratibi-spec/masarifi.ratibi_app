import { ErrorState } from "@/components/admin/ui";
import { securityDetailIdSchema } from "@/features/security/contracts";
import { IncidentDetailRoute } from "@/features/security/SecurityViews";

export default async function IncidentPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  const parsed = securityDetailIdSchema("INC").safeParse(incidentId);
  return parsed.success ? <IncidentDetailRoute incidentId={parsed.data} /> : <ErrorState />;
}
