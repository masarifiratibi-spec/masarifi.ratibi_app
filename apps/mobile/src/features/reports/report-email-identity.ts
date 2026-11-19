import { getClerkInstance } from '@clerk/expo';
import { useAppShellStore } from '@/state/app-shell';

export type ReportEmailIdentity = {
  owner: string;
  sessionId: string;
  email: string;
};

export function readReportEmailIdentity(): ReportEmailIdentity | null {
  const session = useAppShellStore.getState().session;
  if (session?.status !== 'authenticated' || !session.userId) return null;
  try {
    const clerk = getClerkInstance();
    const user = clerk.user;
    const primary = user?.primaryEmailAddress;
    if (
      clerk.session?.status !== 'active' ||
      !clerk.session.id ||
      clerk.session.user?.id !== session.userId ||
      user?.id !== session.userId ||
      primary?.verification?.status !== 'verified'
    )
      return null;
    const email = primary.emailAddress.trim().toLowerCase();
    if (!/^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/u.test(email)) return null;
    return { owner: user.id, sessionId: clerk.session.id, email };
  } catch {
    return null;
  }
}

export function isReportEmailIdentityCurrent(expected: ReportEmailIdentity) {
  const current = readReportEmailIdentity();
  return (
    current?.owner === expected.owner &&
    current.sessionId === expected.sessionId &&
    current.email === expected.email
  );
}

export function observeReportEmailIdentity(onChange: () => void) {
  return getClerkInstance().addListener(onChange);
}
