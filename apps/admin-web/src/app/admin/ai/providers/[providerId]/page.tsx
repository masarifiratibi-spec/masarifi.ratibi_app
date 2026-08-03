import { ErrorState } from "@/components/admin/ui";
import { safeAiIdSchema } from "@/features/ai/contracts";
import { AiProviderDetailRoute } from "@/features/ai/AiViews";

export default async function AiProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const parsed = safeAiIdSchema.safeParse(providerId);
  return parsed.success ? <AiProviderDetailRoute providerId={parsed.data} /> : <ErrorState />;
}
