import { ErrorState } from "@/components/admin/ui";
import { roleIdSchema } from "@/features/governance/contracts";
import { RoleDetailView } from "@/features/governance/GovernanceViews";

export default async function RoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const parsed = roleIdSchema.safeParse(roleId);
  return parsed.success ? <RoleDetailView roleId={parsed.data} /> : <ErrorState />;
}
