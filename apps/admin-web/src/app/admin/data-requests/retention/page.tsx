import { RetentionDetailRoute, RetentionPoliciesRoute } from "@/features/security/PrivacyViews";

export default async function RetentionPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string | string[] }>;
}) {
  const { policy } = await searchParams;
  return typeof policy === "string" && policy
    ? <RetentionDetailRoute policyId={policy} />
    : <RetentionPoliciesRoute />;
}
