import { ErrorState } from "@/components/admin/ui";
import { roleIdSchema } from "@/features/governance/contracts";
import { EditRoleView } from "@/features/governance/GovernanceViews";

export default async function EditRolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const parsed = roleIdSchema.safeParse(roleId);
  return parsed.success ? <EditRoleView roleId={parsed.data} /> : <ErrorState />;
}
