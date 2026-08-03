import { ErrorState } from "@/components/admin/ui";
import { securityIdSchema } from "@/features/security/contracts";
import { IncidentDetailRoute } from "@/features/security/SecurityViews";

export default async function IncidentPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  const parsed = securityIdSchema.safeParse(incidentId);
  return parsed.success && parsed.data.startsWith("INC-") ? <IncidentDetailRoute incidentId={parsed.data} /> : <ErrorState />;
}
