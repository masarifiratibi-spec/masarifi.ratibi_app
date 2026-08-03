import { BillingOverview } from "@/features/billing/BillingOverview";
import { SubscriptionsList } from "@/features/billing/BillingViews";

export default function SubscriptionsPage() {
  return (
    <>
      <BillingOverview />
      <SubscriptionsList />
    </>
  );
}