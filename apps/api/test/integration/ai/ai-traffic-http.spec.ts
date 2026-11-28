import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AiTrafficGuard } from '../../../src/ai/ai-traffic';
import { AiController } from '../../../src/ai/ai.controller';
import { AiService } from '../../../src/ai/ai.service';
import { ClerkAuthGuard, type ClerkPrincipalRequest } from '../../../src/identity/clerk-auth.guard';
import { PoolService } from '../../../src/platform/database/pool.service';
import { SafeExceptionFilter } from '../../../src/platform/http/safe-exception.filter';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('AI limits through the HTTP controller', () => {
  let app: INestApplication;
  const owner = randomUUID(),
    session = randomUUID();
  const pool = createLivePool();
  const ai = {
    createMessage: jest.fn().mockResolvedValue({ id: session }),
    createVoiceSession: jest.fn().mockResolvedValue({ id: session }),
    uploadVoiceAudio: jest.fn().mockResolvedValue({ id: session }),
    processVoiceSession: jest.fn().mockResolvedValue({ id: session }),
    getMessageResult: jest.fn().mockResolvedValue({ status: 'completed' }),
    getVoiceBatchResult: jest.fn().mockResolvedValue({ status: 'completed' }),
    cancelVoiceSession: jest.fn().mockResolvedValue({ status: 'cancelled' }),
  };
  const previous = process.env.MASARIFI_AI_TRAFFIC_MODE;
  beforeAll(async () => {
    process.env.MASARIFI_AI_TRAFFIC_MODE = 'enforce';
    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        AiTrafficGuard,
        { provide: PoolService, useValue: pool },
        { provide: AiService, useValue: ai },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          ctx.switchToHttp().getRequest<ClerkPrincipalRequest>().clerkPrincipal = {
            userId: owner,
            sessionId: session,
            factorAgeSeconds: 0,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new SafeExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    if (previous === undefined) delete process.env.MASARIFI_AI_TRAFFIC_MODE;
    else process.env.MASARIFI_AI_TRAFFIC_MODE = previous;
    await app.close();
  });
  it('sends and polls normally, rejects excess work before dispatch, and permits cancellation', async () => {
    const http = request(app.getHttpServer() as Server);
    const messages = '/api/v1/assistant/conversations/' + session + '/messages';
    const voice = '/api/v1/voice/sessions';
    await http.post(messages).send({ content: 'fixture' }).expect(202);
    await http.get(messages + '/' + session + '/result?waitMs=500').expect(200);
    await http.post(voice).expect(201);
    await http
      .put(voice + '/' + session + '/audio')
      .send(Buffer.from('fixture'))
      .expect(200);
    await http.post(voice + '/' + session + '/process').expect(202);
    await http.get(voice + '/' + session + '/batch').expect(200);
    await http.post(messages).expect(202);
    await http.post(messages).expect(202);
    const busy = await http.post(messages).expect(429);
    expect((busy.body as { code: string }).code).toBe('AI_TRAFFIC_LIMITED');
    expect(Number(busy.headers['retry-after'])).toBeGreaterThan(0);
    expect(busy.headers['x-masarifi-ai-limit']).toBe('traffic');
    expect(ai.createMessage).toHaveBeenCalledTimes(3);
    await http.post(voice + '/' + session + '/cancel').expect(200);
    process.env.MASARIFI_AI_TRAFFIC_MODE = 'shadow';
    await http.post(messages).expect(202);
  });
});
