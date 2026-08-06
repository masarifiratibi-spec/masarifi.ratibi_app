/**
 * English message catalog.
 *
 * Every user-facing string in the foundation resolves through this catalog.
 * Arabic and English keys MUST stay in 1:1 parity; the typed MessageKey
 * enforces this at compile time. Constitution Principle III (Arabic-First,
 * Accessible Parity) and UI Contract §7.
 */

const en = {
  // App shell
  'app.title': 'Masarifi',
  'app.foundationTitle': 'Foundation Validation Harness',
  'app.foundationIntro':
    'Temporary validation screen. Production screens are built in later specs.',

  // Navigation menu
  'nav.position': 'Financial Position',
  'nav.capture': 'Capture & Fallback',
  'nav.trust': 'Financial Trust',
  'nav.accessibility': 'Language & Accessibility',

  // Financial position panel
  'position.title': 'Your Financial Position',
  'position.balance': 'Current balance',
  'position.spending': 'Recent spending',
  'position.nextObligation': 'Next obligation',
  'position.reviewItems': 'Needs your attention',
  'position.empty.title': 'Welcome to Masarifi',
  'position.empty.action': 'Add your first transaction',
  'position.partial.title': 'Some information is incomplete',
  'position.partial.action': 'Review missing data',
  'position.nextAction': 'Next action',
  'position.estimated': 'estimated',

  // Capture fallback panel
  'capture.title': 'Capture Options',
  'capture.sms.title': 'SMS tracking (Android)',
  'capture.sms.purpose': 'Detect transactions from bank SMS automatically',
  'capture.sms.dataUse':
    'Messages are analyzed on your device to add transactions',
  'capture.sms.continue': 'Continue',
  'capture.sms.skip': 'Skip for now',
  'capture.manual': 'Add manually',
  'capture.voice': 'Add by voice',
  'capture.permission.notRequested': 'Permission not requested yet',
  'capture.permission.granted': 'Permission granted',
  'capture.permission.denied':
    'Permission denied — manual entry remains available',
  'capture.permission.permanentlyDenied':
    'Permission permanently denied. Enable it in settings to use SMS tracking.',
  'capture.permission.revoked': 'Permission revoked',
  'capture.permission.unavailable': 'Not available on this device',
  'capture.permission.recover': 'Open settings',
  'capture.permission.disable': 'Turn off SMS tracking',
  'capture.ios.noSms': 'Direct SMS tracking is not available on iOS.',
  'capture.ios.alternatives': 'Use manual, voice, or approved alternatives.',
  'capture.offline.saved': 'Saved locally — pending sync',
  'capture.offline.edit': 'Edit entry',
  'capture.offline.delete': 'Delete entry',
  'capture.offline.retry': 'Retry sync',
  'capture.offline.conflict': 'Sync conflict — review the entry',
  'capture.offline.failed': 'Sync failed — retry when ready',
  'capture.offline.title': 'Offline entry',
  'capture.offline.syncing': 'Syncing',
  'capture.offline.synced': 'Synced',
  'capture.offline.startSync': 'Start sync',
  'capture.offline.confirmSync': 'Confirm sync',
  'capture.offline.failSync': 'Simulate failure',
  'capture.offline.conflictSync': 'Simulate conflict',
  'capture.offline.actionFailed': 'The local action failed. Try again.',
  'capture.offline.nativeBuildRequired':
    'Offline SQLite validation runs in Android and iOS development builds.',
  'capture.action.selected': 'Selected',

  // Financial trust panel
  'trust.title': 'Financial Changes',
  'trust.source': 'Source',
  'trust.undo': 'Undo',
  'trust.edit': 'Edit',
  'trust.report': 'Report problem',
  'trust.review': 'Needs review',
  'trust.confirm': 'Confirm change',
  'trust.preview': 'Preview of the change',
  'trust.applied': 'Applied',
  'trust.rejected': 'Rejected',
  'trust.undone': 'Undone',
  'trust.corrected': 'Corrected',
  'trust.errorTitle': 'Something went wrong',
  'trust.errorAction': 'Try again',
  'trust.retrying': 'Trying again',
  'trust.reported': 'Problem reported',
  'trust.source.automatic': 'Automatic',
  'trust.source.voice': 'Voice',
  'trust.source.manual': 'Manual',
  'trust.source.assistant': 'Assistant',
  'trust.source.platformAssisted': 'Platform-assisted',

  // Accessibility gallery
  'a11y.controls': 'Controls',
  'a11y.locale': 'Language',
  'a11y.theme': 'Theme',
  'a11y.reducedMotion': 'Reduced motion',
  'a11y.hideBalances': 'Hide balances',
  'a11y.stateLoading': 'Loading',
  'a11y.stateSuccess': 'Success',
  'a11y.stateEmpty': 'Nothing here yet',
  'a11y.stateError': 'Error',
  'a11y.stateOffline': 'You are offline',
  'a11y.statePermission': 'Permission required',
  'a11y.stateSync': 'Syncing',
  'a11y.actionRetry': 'Retry',
  'a11y.retryRequested': 'Retry requested',

  // Common
  'common.light': 'Light',
  'common.dark': 'Dark',
  'common.system': 'System',
  'common.arabic': 'العربية',
  'common.english': 'English',
  'common.android': 'Android',
  'common.ios': 'iOS',
  'scenario.populated': 'Populated',
  'scenario.empty': 'Empty',
  'scenario.partial': 'Partial',
  'scenario.clear': 'Clear',
  'scenario.ambiguous': 'Ambiguous',
  'scenario.duplicate': 'Duplicate',
  'scenario.failed': 'Failed',
  'scenario.assistant': 'Assistant proposal'
} as const;

export type MessageKey = keyof typeof en;
export type MessageCatalog = Record<MessageKey, string>;

export default en;
