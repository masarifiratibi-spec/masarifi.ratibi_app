import { InvitationAcceptanceView } from "@/features/governance/GovernanceViews";

export default async function InvitationAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ invitationToken?: string }>;
}) {
  const { invitationToken = "" } = await searchParams;
  return <InvitationAcceptanceView token={invitationToken} />;
}
