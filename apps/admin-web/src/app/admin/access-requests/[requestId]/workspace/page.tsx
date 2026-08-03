"use client";

import { useParams } from "next/navigation";
import { ErrorState } from "@/components/admin/ui";
import { accessRequestIdSchema } from "@/features/access/contracts";
import { TemporaryAccessWorkspace } from "@/features/access/TemporaryAccessWorkspace";

export default function TemporaryAccessWorkspacePage() {
  const params = useParams<{ requestId: string }>();
  const requestId = accessRequestIdSchema.safeParse(params.requestId);
  return requestId.success ? <TemporaryAccessWorkspace requestId={requestId.data} /> : <ErrorState />;
}
