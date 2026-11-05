import { requireOptionalNativeModule } from 'expo-modules-core';

export interface MasarifiSmsInboxModule {
  prepareTrackingOwnerV4?(request: string): Promise<void>;
  commitTrackingOwnerV4?(
    ownerDigest: string,
    generation: string
  ): Promise<void>;
  configureTrackingOwnerV4?(request: string): Promise<void>;
  suspendTrackingOwnerV4?(
    ownerDigest: string,
    generation: string
  ): Promise<void>;
  clearTrackingOwnerV4?(ownerDigest: string, generation: string): Promise<void>;
  purgeTrackingOwnerDataV4?(
    ownerDigest: string,
    generation: string
  ): Promise<void>;
  resumeTrackingOwnerPurgeV4?(
    ownerDigest: string,
    generation: string | null
  ): Promise<void>;
  notificationCaptureIssueV4?(
    ownerDigest: string,
    generation: string
  ): Promise<string | null>;
  setNotificationCaptureEnabledV4?(
    ownerDigest: string,
    generation: string,
    enabled: boolean
  ): Promise<void>;
  readRecentNotificationsV4?(
    ownerDigest: string,
    generation: string,
    limit: number
  ): Promise<unknown>;
  retainedNotificationCountV4?(
    ownerDigest: string,
    generation: string
  ): Promise<number>;
  acknowledgeNotificationsV4?(
    ownerDigest: string,
    generation: string,
    keys: readonly string[]
  ): Promise<void>;
  readFinancialSmsPageV4?(request: string): Promise<unknown>;
  presentCaptureConfirmationV4?(request: string): Promise<boolean>;
  scheduleTrackingFollowUp?(
    ownerDigest: string,
    generation: string
  ): Promise<boolean>;
  financialContentAdmissionSupported?(): Promise<boolean>;
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
  readFinancialSmsPageV2?(
    since: number,
    afterId: string,
    limit: number,
    ownerDigest: string
  ): Promise<unknown>;
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
  purgeTrackingOwnerData?(ownerDigest: string): Promise<void>;
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
