import { HttpException } from '@nestjs/common';
import { AiRepository } from '../../../src/ai/ai.repository';

it.each(['AUTH_TOKEN_INVALID', 'PROFILE_INACTIVE', 'FINANCIAL_ACCESS_DENIED'])(
  'settles permanent operating %s once without scheduling an event retry',
  async (code) => {
    const sql: string[] = [];
    const client = {
      query: (text: string) => {
        sql.push(text);
        if (text.includes('claim_staging_voice_finalization'))
          return Promise.resolve({ rows: [{ batch_id: 'batch', token: 'lease' }] });
        if (text.includes('list_voice_finalization_events'))
          return Promise.resolve({ rows: [{ result: [{ eventId: 'event' }] }] });
        if (text.includes('execute_operating_voice_event'))
          return Promise.reject(new HttpException({ code }, 403));
        return Promise.resolve({ rows: [{ result: {} }] });
      },
    };
    const repository = new AiRepository({
      withClient: (action: (c: unknown) => unknown) => action(client),
    } as never);
    await repository.finalizeVoiceEpoch('epoch', 1, false, true);
    expect(sql.filter((q) => q.includes('fail_operating_voice_event'))).toHaveLength(1);
    expect(sql.some((q) => q.includes('retry_voice_event'))).toBe(false);
  },
);
