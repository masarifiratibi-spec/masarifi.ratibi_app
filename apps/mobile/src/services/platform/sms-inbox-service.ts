export interface RawSmsMessage {
  id: string;
  sender: string;
  body: string;
  receivedAt: number;
  observedAt?: number;
}

export interface SmsInboxService {
  available: boolean;
  readPage?(input: {
    since: number;
    limit: number;
    afterId?: string;
    ownerId: string;
  }): Promise<SmsInboxPage>;
  readRecent(input: {
    since: number;
    limit: number;
    afterId?: string;
  }): Promise<RawSmsMessage[]>;
  isNetworkAvailable(): Promise<boolean>;
}

export interface SmsInboxPage {
  version: 2;
  messages: RawSmsMessage[];
  lastScanned: { receivedAt: number; id: string };
  hasMore: boolean;
  scanned: number;
}

export function createSmsInboxService(): SmsInboxService {
  return {
    available: false,
    async readRecent() {
      return [];
    },
    async isNetworkAvailable() {
      return false;
    }
  };
}

export const smsInboxService = createSmsInboxService();
