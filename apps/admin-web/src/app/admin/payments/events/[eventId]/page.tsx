import { safeIdSchema } from "@/features/billing/contracts";
import { PaymentEventDetailView } from "@/features/billing/BillingViews";

export default async function PaymentEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const parsed = safeIdSchema.safeParse(eventId);
  return <PaymentEventDetailView eventId={parsed.success ? parsed.data : "invalid-id"} />;
}
