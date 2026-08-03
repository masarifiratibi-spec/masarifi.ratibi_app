import { RetentionDetailRoute, RetentionPoliciesRoute } from "@/features/security/PrivacyViews";

export default function RetentionPoliciesPage() {
  return <>
    <RetentionPoliciesRoute />
    <RetentionDetailRoute />
  </>;
}
