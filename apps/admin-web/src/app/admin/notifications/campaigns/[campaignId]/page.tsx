import { ErrorState } from "@/components/admin/ui";
import { routeRecordIdSchema } from "@/features/communications/contracts";
import { CampaignDetailRoute } from "@/features/communications/CommunicationRoutes";

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const parsed = routeRecordIdSchema.safeParse(campaignId);
  return parsed.success ? <CampaignDetailRoute campaignId={parsed.data} /> : <ErrorState />;
}
