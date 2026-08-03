import { ErrorState } from "@/components/admin/ui";
import { safeIdSchema } from "@/features/imports/contracts";
import { ParserRuleDetailView } from "@/features/imports/ParserViews";

export default async function ParserRuleDetailPage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  const parsed = safeIdSchema.safeParse(ruleId);
  return parsed.success ? <ParserRuleDetailView ruleId={parsed.data} /> : <ErrorState />;
}
