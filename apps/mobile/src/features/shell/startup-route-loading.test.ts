const mockStartupScreenInitializations: string[] = [];

jest.mock('@/features/reports/ReportsScreen', () => {
  mockStartupScreenInitializations.push('reports');
  return jest.requireActual('@/features/reports/ReportsScreen');
});
jest.mock('@/features/reports/ReportDrillDownScreen', () => {
  mockStartupScreenInitializations.push('report-drill-down');
  return jest.requireActual('@/features/reports/ReportDrillDownScreen');
});
jest.mock('@/features/reports/ReportPreviewScreen', () => {
  mockStartupScreenInitializations.push('report-preview');
  return jest.requireActual('@/features/reports/ReportPreviewScreen');
});
jest.mock('@/features/transactions/TransactionListScreen', () => {
  mockStartupScreenInitializations.push('transactions');
  return jest.requireActual('@/features/transactions/TransactionListScreen');
});
jest.mock('@/features/assistant/AssistantHomeScreen', () => {
  mockStartupScreenInitializations.push('assistant');
  return jest.requireActual('@/features/assistant/AssistantHomeScreen');
});
jest.mock('@/features/assistant/AssistantConversationScreen', () => {
  mockStartupScreenInitializations.push('assistant-conversation');
  return jest.requireActual('@/features/assistant/AssistantConversationScreen');
});
jest.mock('@/features/notifications/NotificationCenterScreen', () => {
  mockStartupScreenInitializations.push('notifications');
  return jest.requireActual('@/features/notifications/NotificationCenterScreen');
});
jest.mock('@/features/notifications/NotificationPreferencesScreen', () => {
  mockStartupScreenInitializations.push('notification-preferences');
  return jest.requireActual('@/features/notifications/NotificationPreferencesScreen');
});

it('discovers destinations without initializing screens that startup does not display', () => {
  for (const route of [
    '../../../app/(tabs)/reports',
    '../../../app/(tabs)/transactions',
    '../../../app/reports/drill-down',
    '../../../app/reports/preview',
    '../../../app/assistant/index',
    '../../../app/assistant/[conversationId]/index',
    '../../../app/notifications/index',
    '../../../app/notifications/preferences'
  ]) {
    expect(jest.requireActual(route).default).toEqual(expect.any(Function));
  }
  expect(mockStartupScreenInitializations).toEqual([]);
});
