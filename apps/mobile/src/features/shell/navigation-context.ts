export const shellDestinations = [
  '/(tabs)/home',
  '/(tabs)/transactions',
  '/(tabs)/add',
  '/(tabs)/reports',
  '/(tabs)/more',
  '/transactions',
  '/add',
  '/reports',
  '/more',
  '/accounts',
  '/assistant',
  '/tracking',
  '/notifications',
  '/notifications/preferences',
  '/subscriptions',
  '/subscriptions/checkout',
  '/profile',
  '/profile/application',
  '/profile/privacy',
  '/security/settings',
  '/security/sessions',
  '/security/events',
  '/support',
  '/support/new',
  '/support/tickets'
] as const;

type StaticShellDestination = (typeof shellDestinations)[number];
export type ShellDynamicDestination =
  | `/assistant/${string}`
  | `/assistant/${string}/actions/${string}`
  | `/support/tickets/${string}`;
export type ShellDestination = StaticShellDestination | ShellDynamicDestination;

export const primaryTabRoutes = [
  '/(tabs)/home',
  '/assistant',
  '/(tabs)/transactions'
] as const;
export type PrimaryTabRoute = (typeof primaryTabRoutes)[number];

const destinationSet = new Set<string>(shellDestinations);
const routeParameterPattern = /^[A-Za-z0-9_-]+$/;
const sensitiveRoutePattern =
  /phone|otp|pin|amount|message|email|token|secret|password/i;

function isSafeParameter(value: string) {
  return (
    routeParameterPattern.test(value) && !sensitiveRoutePattern.test(value)
  );
}

export function assistantConversationDestination(
  conversationId: string
): ShellDestination | null {
  return isSafeParameter(conversationId)
    ? `/assistant/${conversationId}`
    : null;
}

export function assistantActionDestination(
  conversationId: string,
  previewId: string
): ShellDestination | null {
  return isSafeParameter(conversationId) && isSafeParameter(previewId)
    ? `/assistant/${conversationId}/actions/${previewId}`
    : null;
}

export function supportTicketDestination(
  ticketId: string
): ShellDestination | null {
  return isSafeParameter(ticketId) ? `/support/tickets/${ticketId}` : null;
}

export function sanitizeReturnRoute(
  route: string | null
): ShellDestination | null {
  if (
    !route ||
    route.includes('?') ||
    route.includes('#') ||
    !route.startsWith('/')
  ) {
    return null;
  }
  if (destinationSet.has(route)) return route as StaticShellDestination;

  const assistantAction = /^\/assistant\/([^/]+)\/actions\/([^/]+)$/.exec(
    route
  );
  if (assistantAction) {
    return assistantActionDestination(assistantAction[1], assistantAction[2]);
  }
  const assistantConversation = /^\/assistant\/([^/]+)$/.exec(route);
  if (assistantConversation)
    return assistantConversationDestination(assistantConversation[1]);
  const supportTicket = /^\/support\/tickets\/([^/]+)$/.exec(route);
  return supportTicket ? supportTicketDestination(supportTicket[1]) : null;
}

export function createReturnContext(
  destination: '/accounts' | '/assistant',
  origin: string
) {
  const returnTo = sanitizeReturnRoute(origin) ?? '/(tabs)/home';
  return { destination, returnTo };
}

export function sanitizePrimaryTabRoute(route: string | null): PrimaryTabRoute {
  const sanitized = sanitizeReturnRoute(route);
  return (
    primaryTabRoutes.find((candidate) => candidate === sanitized) ??
    '/(tabs)/home'
  );
}

export function tabOrderForDirection(
  direction: 'ltr' | 'rtl'
): PrimaryTabRoute[] {
  return direction === 'rtl'
    ? [...primaryTabRoutes].reverse()
    : [...primaryTabRoutes];
}

export function backIconForDirection(direction: 'ltr' | 'rtl') {
  return direction === 'rtl' ? 'chevron-right' : 'chevron-left';
}

export function utilityIcon(icon: 'close' | 'settings' | 'security') {
  return icon;
}
