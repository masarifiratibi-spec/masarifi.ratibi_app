import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { HttpException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import type { ClerkPrincipalRequest } from '../identity/clerk-auth.guard';
import { PlatformLogger } from '../platform/observability/platform-logger';
import { PoolService } from '../platform/database/pool.service';

export function aiTrafficMode() {
  return process.env.MASARIFI_AI_TRAFFIC_MODE ?? 'off';
}

const policies: Record<string, string> = {
  createMessage: 'chat',
  createVoiceSession: 'create',
  uploadVoiceAudio: 'upload',
  processVoiceSession: 'process',
  getMessageResult: 'poll',
  getMessageAcceptance: 'poll',
  getMessage: 'poll',
  getResponse: 'poll',
  getVoiceBatchResult: 'poll',
  getVoiceSession: 'poll',
  getVoiceRecovery: 'poll',
  getVoiceProposal: 'poll',
  listVoiceBatchRecovery: 'poll',
};

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AiTrafficGuard implements CanActivate {
  private readonly logger = new PlatformLogger();
  constructor(private readonly pool: PoolService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode = aiTrafficMode();
    const handler = context.getHandler().name;
    if (mode === 'off' || handler === 'cancelVoiceSession') return true;
    const http = context.switchToHttp();
    const request = http.getRequest<ClerkPrincipalRequest>();
    const response = http.getResponse<Response>();
    if (!request.clerkPrincipal) throw new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401);
    const peer = request.socket.remoteAddress?.replace(/^::ffff:/, '') ?? '';
    const realIp = request.headers['x-real-ip'];
    const ip =
      peer &&
      peer === process.env.MASARIFI_AI_TRUSTED_PROXY_IP &&
      typeof realIp === 'string' &&
      isIP(realIp)
        ? realIp
        : peer;
    const bucket = policies[handler] ?? 'other';
    const body: unknown = request.body;
    const stream =
      bucket === 'chat' &&
      typeof body === 'object' &&
      body !== null &&
      'responseMode' in body &&
      body.responseMode === 'stream';
    const longPoll = handler === 'getMessageResult' && Number(request.query.waitMs) > 0;
    const lane = bucket === 'upload' ? 'upload' : stream || longPoll ? 'wait' : 'normal';
    const token = randomUUID();
    let retry: number;
    try {
      const { rows } = await this.pool.query<{ retry: number }>(
        'select private.ai_http_admit($1,$2,$3,$4,$5) retry',
        [token, digest(request.clerkPrincipal.userId), digest(ip), bucket, lane],
      );
      const admission = rows[0];
      if (!admission) throw new Error('AI_TRAFFIC_ADMISSION_MISSING');
      retry = admission.retry;
    } catch {
      this.logger.warn('AI_TRAFFIC_STORE_UNAVAILABLE', { operation: bucket, state: mode });
      if (mode === 'enforce' && request.method !== 'GET')
        throw new HttpException({ code: 'AI_TEMPORARILY_UNAVAILABLE' }, 503);
      return true;
    }
    if (retry > 0) {
      this.logger.warn('AI_TRAFFIC_LIMITED', {
        operation: bucket,
        resourceType: lane,
        state: mode,
      });
      if (mode === 'enforce')
        throw new HttpException({ code: 'AI_TRAFFIC_LIMITED', retryAfter: retry }, 429);
      return true;
    }
    const release = () => {
      response.removeListener('finish', release);
      response.removeListener('close', release);
      clearTimeout(deadline);
      void this.pool.query('select private.ai_http_release($1)', [token]).catch(() => {
        this.logger.warn('AI_TRAFFIC_RELEASE_FAILED', { operation: bucket });
      });
    };
    // Bound enforce-mode sockets before their database lease can expire.
    const deadline =
      mode === 'enforce' ? setTimeout(() => response.destroy(), 235_000).unref() : undefined;
    response.once('finish', release);
    response.once('close', release);
    if (response.destroyed || response.writableFinished) {
      release();
      return false;
    }
    return true;
  }
}
