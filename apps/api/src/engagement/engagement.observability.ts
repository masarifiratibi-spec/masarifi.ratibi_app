import { Injectable } from '@nestjs/common';

import {
  ENGAGEMENT_METRICS,
  recordPlatformMetric,
  type MetricSink,
} from '../platform/observability/platform-metrics';

const jobs = new Set([
  'source.consume',
  'voice.confirmation.source.wait',
  'voice.confirmation.delivery.wait',
  'notification.dispatch',
  'notification.delivery.retry',
  'notification.campaign.expand',
  'notification.expire',
  'support-attachment.scan',
  'support-attachment.cleanup',
]);
const outcomes = new Set(['empty', 'claimed', 'success', 'retry', 'suppressed', 'failure']);
const channels = new Set(['none', 'in_app', 'push', 'email']);
const providers = new Set(['none', 'database', 'push', 'expo', 'apns', 'fcm', 'smtp']);

@Injectable()
export class EngagementObservability {
  constructor(private readonly sink?: MetricSink) {}

  job(
    job: string,
    outcome: string,
    channel = 'none',
    provider = 'none',
    value = 1,
    durationMs?: number,
  ): void {
    if (
      !jobs.has(job) ||
      !outcomes.has(outcome) ||
      !channels.has(channel) ||
      !providers.has(provider) ||
      (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0))
    )
      throw new Error('ENGAGEMENT_METRIC_LABEL_INVALID');
    recordPlatformMetric(
      ENGAGEMENT_METRICS.job,
      value,
      { job, outcome, channel, provider },
      this.sink,
    );
    if (durationMs !== undefined)
      recordPlatformMetric(
        ENGAGEMENT_METRICS.duration,
        durationMs,
        { job, outcome, channel, provider },
        this.sink,
      );
  }

  // The wait histogram includes time spent in retry or quiet hours.
  voicePoll(kind: 'source' | 'delivery', queuedAt?: string): void {
    const queued = queuedAt === undefined ? NaN : Date.parse(queuedAt);
    this.job(
      `voice.confirmation.${kind}.wait`,
      queuedAt === undefined ? 'empty' : 'claimed',
      'none',
      'database',
      1,
      Number.isFinite(queued) ? Math.max(0, Date.now() - queued) : undefined,
    );
  }

  backlog(job: string, value: number): void {
    if (!jobs.has(job) || !Number.isSafeInteger(value) || value < 0)
      throw new Error('ENGAGEMENT_METRIC_LABEL_INVALID');
    recordPlatformMetric(ENGAGEMENT_METRICS.backlog, value, { job }, this.sink);
  }
}
