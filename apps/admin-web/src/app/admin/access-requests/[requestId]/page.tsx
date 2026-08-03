"use client";

import { useParams } from "next/navigation";
import { ErrorState } from "@/components/admin/ui";
import { AccessRequestView } from "@/features/access/AccessRequestView";
import { accessRequestIdSchema } from "@/features/access/contracts";

export default function AccessRequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = accessRequestIdSchema.safeParse(params.requestId);
  return requestId.success ? <AccessRequestView requestId={requestId.data} /> : <ErrorState />;
}
