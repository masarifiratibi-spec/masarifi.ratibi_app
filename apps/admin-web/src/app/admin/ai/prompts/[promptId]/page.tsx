import { ErrorState } from "@/components/admin/ui";
import { safeAiIdSchema } from "@/features/ai/contracts";
import { AiPromptDetailRoute } from "@/features/ai/AiViews";

export default async function AiPromptPage({ params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  const parsed = safeAiIdSchema.safeParse(promptId);
  return parsed.success ? <AiPromptDetailRoute promptId={parsed.data} /> : <ErrorState />;
}
