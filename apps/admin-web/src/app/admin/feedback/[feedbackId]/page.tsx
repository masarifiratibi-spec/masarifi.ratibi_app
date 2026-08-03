import { ErrorState } from "@/components/admin/ui";
import { routeRecordIdSchema } from "@/features/communications/contracts";
import { FeedbackDetailRoute } from "@/features/communications/CommunicationRoutes";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  const parsed = routeRecordIdSchema.safeParse(feedbackId);
  return parsed.success ? <FeedbackDetailRoute feedbackId={parsed.data} /> : <ErrorState />;
}
