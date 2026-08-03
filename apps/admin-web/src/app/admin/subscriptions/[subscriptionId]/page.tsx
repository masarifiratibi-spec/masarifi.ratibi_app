import { safeIdSchema } from "@/features/billing/contracts";
import { SubscriptionDetailView } from "@/features/billing/BillingViews";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = await params;
  const parsed = safeIdSchema.safeParse(subscriptionId);
  return <SubscriptionDetailView subscriptionId={parsed.success ? parsed.data : "invalid-id"} />;
}
