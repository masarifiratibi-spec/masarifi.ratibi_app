import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PoolService } from '../platform/database/pool.service';
import type { AiCompletion, EffectiveAiRoute } from './ai.gateway';
import type { AssistantAgentClaim, GroundedAssistantAnswer } from './assistant-agent';

@Injectable()
export class AssistantAgentRepository {
  constructor(private readonly pool: PoolService) {}

  claim(owner: string): Promise<AssistantAgentClaim | null> {
    return this.call('select private.claim_assistant_agent_job($1,180) result', [owner]);
  }

  authorizeDispatch(claim: AssistantAgentClaim, route: EffectiveAiRoute): Promise<boolean> {
    return this.call(
      'select private.authorize_assistant_agent_dispatch($1::uuid,$2::uuid,$3::jsonb) result',
      [claim.id, claim.claimToken, JSON.stringify(route)],
    );
  }

  finish(claim: AssistantAgentClaim, answer: GroundedAssistantAnswer) {
    return this.call(
      'select private.finish_assistant_agent_job($1::uuid,$2::uuid,$3::jsonb) result',
      [claim.id, claim.claimToken, JSON.stringify({ ...answer, preview: null })],
    );
  }

  fail(claim: AssistantAgentClaim, code: string, retry: boolean) {
    return this.call('select private.fail_assistant_agent_job($1::uuid,$2::uuid,$3,$4) result', [
      claim.id,
      claim.claimToken,
      code,
      retry,
    ]);
  }

  receipt(claim: AssistantAgentClaim, receipt: AiCompletion<unknown>) {
    const generationHash = createHash('sha256').update(receipt.generationId).digest('hex');
    return this.record(claim, {
      generationHash,
      model: receipt.model,
      provider: receipt.provider,
      usage: receipt.usage,
      latencyMs: receipt.latencyMs,
      fallbackUsed: receipt.fallbackUsed,
    });
  }

  uncertainDispatch(claim: AssistantAgentClaim) {
    return this.record(claim, { uncertain: true });
  }

  private record(claim: AssistantAgentClaim, receipt: Record<string, unknown>) {
    return this.call(
      'select private.record_assistant_agent_receipt($1::uuid,$2::uuid,$3::jsonb) result',
      [claim.id, claim.claimToken, JSON.stringify(receipt)],
    );
  }

  private call<T>(sql: string, args: unknown[]): Promise<T> {
    return this.pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_worker');
        await client.query("select set_config('request.jwt.claims','{}',true)");
        const response = await client.query<{ result: T }>(sql, args);
        await client.query('commit');
        const row = response.rows[0];
        if (!row) throw new Error('AI_DATABASE_RESULT_MISSING');
        return row.result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
}
