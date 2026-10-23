export interface AdminReportCounts {
  totalUsers: number;
  newUsers: number;
  iosUsers: number;
  androidUsers: number;
  bothUsers: number;
  iosDevices: number;
  androidDevices: number;
  unknownUsers?: number;
  newIosUsers?: number;
  newAndroidUsers?: number;
  newBothUsers?: number;
  newUnknownUsers?: number;
  observedAt?: string;
  timezone?: string;
  periodStart?: string;
  periodEnd?: string;
  collectionStartedAt?: string;
  activity?: {
    total: number;
    ios: number;
    android: number;
    daily: AdminTrendPoint[];
    monthly: AdminTrendPoint[];
  };
  growth?: AdminTrendPoint[];
  importVolume?: AdminTrendPoint[];
  versions?: Record<string, unknown>[];
  operations?: Array<{
    id: string;
    kind: string;
    total: number;
    successful?: number;
    failed?: number;
    platformScope: string;
  }>;
}
export interface AdminTrendPoint {
  timestamp: string;
  value: number | null;
}
