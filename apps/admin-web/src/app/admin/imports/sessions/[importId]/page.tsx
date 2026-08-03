import { ErrorState } from "@/components/admin/ui";
import { safeIdSchema } from "@/features/imports/contracts";
import { OperationalDetailView } from "@/features/imports/ImportsViews";

export default async function ImportSessionDetailPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = await params;
  const parsed = safeIdSchema.safeParse(importId);
  return parsed.success
    ? <OperationalDetailView id={parsed.data} resource="sessions" />
    : <ErrorState />;
}
