import { ErrorState } from "@/components/admin/ui";
import { routeRecordIdSchema } from "@/features/communications/contracts";
import { ContentDetailRoute } from "@/features/communications/CommunicationRoutes";

export default async function ContentCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const parsed = routeRecordIdSchema.safeParse(categoryId);
  return parsed.success ? <ContentDetailRoute collection="categories" itemId={parsed.data} /> : <ErrorState />;
}
