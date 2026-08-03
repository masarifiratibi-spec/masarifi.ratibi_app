import { ErrorState } from "@/components/admin/ui";
import { safeIdSchema } from "@/features/imports/contracts";
import { BankDetailView } from "@/features/imports/ParserViews";

export default async function BankDetailPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const { bankId } = await params;
  const parsed = safeIdSchema.safeParse(bankId);
  return parsed.success ? <BankDetailView bankId={parsed.data} /> : <ErrorState />;
}
