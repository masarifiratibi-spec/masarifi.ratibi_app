export type BankNotificationAccessState = 'granted' | 'denied' | 'unavailable';

export interface RawBankNotification {
  key: string;
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
  nativeKey?: string;
  observedAt?: number;
  discovered?: boolean;
  captureActivatedAt?: number;
  capturePolicy?: string;
}

export interface BankNotificationService {
  getCaptureIssue?(): Promise<string | null>;
  getAccessState(): Promise<BankNotificationAccessState>;
  openSettings(): Promise<void>;
  setCaptureEnabled(enabled: boolean): Promise<void>;
  readRecent(limit: number): Promise<RawBankNotification[]>;
  acknowledge(keys: readonly string[]): Promise<void>;
}

export function createBankNotificationService(): BankNotificationService {
  return {
    async getAccessState() {
      return 'unavailable';
    },
    async openSettings() {},
    async setCaptureEnabled() {},
    async readRecent() {
      return [];
    },
    async acknowledge() {}
  };
}

export const bankNotificationService = createBankNotificationService();
