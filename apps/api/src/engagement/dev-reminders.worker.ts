import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { PushTokenCrypto } from '../identity/push-token.crypto';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { PoolService } from '../platform/database/pool.service';
import {
  ExpoPushProvider,
  type HttpTransport,
  type ProviderResult,
} from './notification.providers';
import { renderNotification } from './notification.renderer';

interface DevClaim {
  eventId: string;
  userId: string;
  deviceId: string;
  tokenCiphertext: string;
  provider: 'expo';
}
interface DevContent {
  title: string;
  body: string;
  locale: 'ar' | 'en';
  route: string;
  eventType: string;
}

@Injectable()
export class DevRemindersWorker {
  private running = false;

  constructor(
    private readonly pool: PoolService,
    private readonly config: PlatformConfigService,
  ) {}

  async runOnce(): Promise<void> {
    if (!this.config.get('MASARIFI_RETURN_REMINDERS_ENABLED') || this.running) return;
    if (this.config.get('MASARIFI_ENGAGEMENT_PROVIDER_MODE') !== 'live') return;
    this.running = true;
    try {
      await this.pool.query('select private.expire_dev_reminder_submissions()');
      await this.pool.query('select private.enqueue_dev_reminders(100)');
      for (let i = 0; i < 100; i += 1) {
        const claim = (
          await this.pool.query<{ value: DevClaim | null }>(
            'select private.claim_dev_reminder() value',
          )
        ).rows[0]?.value;
        if (!claim) break;
        await this.deliver(claim);
      }
      const receipts = await this.pool.query<{ event_id: string; provider_ref: string }>(
        'select * from private.pending_dev_receipts()',
      );
      for (const receipt of receipts.rows) {
        try {
          const result = await this.provider().receipt(receipt.provider_ref);
          await this.pool.query('select private.finish_dev_reminder($1,$2,null,$3)', [
            receipt.event_id,
            result.status === 'pending' ? 'accepted' : result.status,
            result.status === 'rejected' ? result.code : null,
          ]);
        } catch {
          // Polling failure never resubmits an accepted notification.
          await this.pool.query(
            "select private.finish_dev_reminder($1,'accepted',null,'RECEIPT_UNAVAILABLE')",
            [receipt.event_id],
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(claim: DevClaim): Promise<void> {
    // The committed sending reservation survives crashes. An uncertain send is never retried.
    try {
      await this.pool.withClient(async (client) => {
        await client.query('begin');
        try {
          const content = (
            await client.query<{ value: DevContent | null }>(
              'select private.prepare_dev_reminder($1) value',
              [claim.eventId],
            )
          ).rows[0]?.value;
          if (content) {
            const rendered = renderNotification(
              {
                key: 'dev.' + content.eventType,
                locale: content.locale,
                channel: 'push',
                version: 1,
                title: content.title,
                body: content.body,
                allowedVariables: [],
              },
              {},
            );
            let token = this.crypto().decrypt(claim.tokenCiphertext, {
              provider: claim.provider,
              userId: claim.userId,
              deviceId: claim.deviceId,
            });
            let result: ProviderResult;
            try {
              result = await this.provider().send({
                token,
                notificationId: claim.eventId,
                title: rendered.title,
                body: rendered.body,
                route: content.route,
              });
            } catch {
              result = { status: 'ambiguous', code: 'PROVIDER_ACCEPTANCE_UNKNOWN' };
            } finally {
              token = '';
            }
            await this.finish(client, claim.eventId, result);
          }
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        }
      });
    } catch {
      await this.pool.query(
        "select private.finish_dev_reminder($1,'unknown',null,'SUBMISSION_UNCERTAIN')",
        [claim.eventId],
      );
    }
  }

  private async finish(client: PoolClient, eventId: string, result: ProviderResult): Promise<void> {
    await client.query('select private.finish_dev_reminder($1,$2,$3,$4)', [
      eventId,
      result.status === 'accepted'
        ? 'accepted'
        : result.status === 'retryable'
          ? 'queued'
          : result.status === 'terminal'
            ? 'rejected'
            : 'unknown',
      result.status === 'accepted' ? result.providerRef : null,
      result.status === 'accepted' ? null : result.code,
    ]);
  }

  private provider(): ExpoPushProvider {
    return new ExpoPushProvider(this.http(), this.config.get('MASARIFI_EXPO_ACCESS_TOKEN') ?? '');
  }

  private crypto(): PushTokenCrypto {
    return new PushTokenCrypto(
      Buffer.from(this.config.getRequired('MASARIFI_PUSH_TOKEN_HASH_KEY'), 'base64url'),
      this.config
        .getRequired('MASARIFI_PUSH_TOKEN_ENCRYPTION_KEYS')
        .split(',')
        .map((entry) => {
          const separator = entry.indexOf(':');
          return {
            id: entry.slice(0, separator),
            key: Buffer.from(entry.slice(separator + 1), 'base64url'),
          };
        }),
    );
  }

  private http(): HttpTransport {
    return async ({ url, headers, body, timeoutMs }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { status: response.status, json: await response.json().catch(() => ({})) };
    };
  }
}
