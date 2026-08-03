import { JobRunDetailView } from "@/features/system-health/JobRunDetailView";

export default async function JobRunDetailPage({ params }: { params: Promise<{ jobRunId: string }> }) {
  const { jobRunId } = await params;
  return <JobRunDetailView jobRunId={jobRunId} />;
}
