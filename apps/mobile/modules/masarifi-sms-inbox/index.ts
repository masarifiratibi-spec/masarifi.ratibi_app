import { requireOptionalNativeModule } from 'expo-modules-core';

export interface MasarifiSmsInboxModule {
  notificationCaptureIssue?(): Promise<string | null>;
  smsActivationBoundary?(): Promise<{ activatedAt: number; afterId: string }>;
  configureTrackingOwnerV3?(
    ownerDigest: string,
    generation: string,
    smsEnabled: boolean,
    notificationEnabled: boolean,
    packages: string[],
    blockedPackages: string[],
    discoveryPolicy: string | null,
    activationBoundaries: string
  ): Promise<void>;
  readRecentSms(since: number, limit: number): Promise<unknown>;
  readSmsPage(since: number, afterId: string, limit: number): Promise<unknown>;
  configureTrackingOwner(
    ownerDigest: string,
    generation: string,
    smsEnabled: boolean,
    notificationEnabled: boolean,
    packages: string[],
    blockedPackages: string[],
    discoveryPolicy: string | null
  ): Promise<void>;
  suspendTrackingOwner(): Promise<void>;
  restoreTrackingOwner(
    ownerDigest: string,
    generation: string | null
  ): Promise<string>;
  clearTrackingOwner(): Promise<void>;
  finishTrackingWork(workId: string, succeeded: boolean): Promise<void>;
  presentCaptureConfirmation(
    ownerId: string,
    notificationId: string,
    title: string,
    body: string
  ): Promise<boolean>;
  isNetworkAvailable(): Promise<unknown>;
  isNotificationAccessEnabled(): Promise<unknown>;
  openNotificationAccessSettings(): Promise<void>;
  setNotificationCaptureEnabled(enabled: boolean): Promise<void>;
  readRecentNotifications(limit: number): Promise<unknown>;
  acknowledgeNotifications(keys: readonly string[]): Promise<void>;
}

export const MasarifiSmsInbox =
  requireOptionalNativeModule<MasarifiSmsInboxModule>('MasarifiSmsInbox');
