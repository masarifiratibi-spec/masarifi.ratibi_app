import { ErrorState } from "@/components/admin/ui";
import { adminIdSchema } from "@/features/governance/contracts";
import { AdminProfileView } from "@/features/governance/GovernanceViews";

export default async function AdminProfilePage({ params }: { params: Promise<{ adminId: string }> }) {
  const { adminId } = await params;
  const parsed = adminIdSchema.safeParse(adminId);
  return parsed.success ? <AdminProfileView adminId={parsed.data} /> : <ErrorState />;
}
