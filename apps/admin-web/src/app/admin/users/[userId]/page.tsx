import { notFound } from "next/navigation";
import { UserDetailView } from "@/features/users/UserDetailView";
import { userIdSchema } from "@/features/users/contracts";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const parsed = userIdSchema.safeParse((await params).userId);
  if (!parsed.success) notFound();
  return <UserDetailView userId={parsed.data} />;
}
