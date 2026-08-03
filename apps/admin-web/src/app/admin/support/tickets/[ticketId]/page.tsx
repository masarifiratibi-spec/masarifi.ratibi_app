import { ErrorState } from "@/components/admin/ui";
import { routeRecordIdSchema } from "@/features/communications/contracts";
import { SupportTicketDetailRoute } from "@/features/communications/CommunicationRoutes";

export default async function SupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const parsed = routeRecordIdSchema.safeParse(ticketId);
  return parsed.success ? <SupportTicketDetailRoute ticketId={parsed.data} /> : <ErrorState />;
}
