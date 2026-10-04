import { AiStorage } from '../../../src/ai/ai.storage';

const key = 'voice/99000000-0000-4000-8000-000000000001/99000000-0000-4000-8000-000000000002';
const config = {
  getRequired: (name: string) =>
    name === 'SUPABASE_URL' ? 'https://storage.example.test' : 'service-role-fixture',
};

describe('private voice object boundary', () => {
  it.each([
    { code: 'NoSuchKey' },
    { code: 'NoSuchKey', statusCode: '404', error: 'not_found', message: 'Object not found' },
  ])(
    'accepts precise NoSuchKey 400 when retrying an already deleted voice object',
    async (body) => {
      // Samsung Staging acceptance, 2026-10-04: real Storage missing-object response.
      const storage = new AiStorage(
        config as never,
        jest.fn(() => Promise.resolve(Response.json(body, { status: 400 }))),
      );
      await expect(storage.delete(key)).resolves.toBeUndefined();
    },
  );

  it.each(['not JSON', 'null', JSON.stringify({ code: 'NoSuchKey', padding: 'x'.repeat(4096) })])(
    'rejects malformed or oversized missing-object evidence',
    async (body) => {
      const storage = new AiStorage(
        config as never,
        jest.fn(() => Promise.resolve(new Response(body, { status: 400 }))),
      );
      await expect(storage.delete(key)).rejects.toThrow('VOICE_STORAGE_UNAVAILABLE');
    },
  );

  it('bounds stalled missing-object evidence and cancels its reader', async () => {
    jest.useFakeTimers();
    try {
      const cancel = jest.fn();
      const storage = new AiStorage(
        config as never,
        jest.fn(() =>
          Promise.resolve(new Response(new ReadableStream({ cancel }), { status: 400 })),
        ),
      );
      const result = expect(storage.delete(key)).rejects.toThrow('VOICE_STORAGE_UNAVAILABLE');
      await jest.advanceTimersByTimeAsync(10_001);
      await result;
      expect(cancel).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    [400, { code: 'InvalidRequest' }],
    [400, { code: 'NoSuchBucket', statusCode: '404' }],
    [400, { code: 'NoSuchKey', statusCode: '403' }],
    [401, { code: 'NoSuchKey' }],
    [403, { code: 'NoSuchKey' }],
    [500, { code: 'NoSuchKey' }],
  ])(
    'keeps Storage failure %i recoverable instead of acknowledging deletion',
    async (status, body) => {
      const storage = new AiStorage(
        config as never,
        jest.fn(() => Promise.resolve(Response.json(body, { status }))),
      );
      await expect(storage.delete(key)).rejects.toThrow('VOICE_STORAGE_UNAVAILABLE');
    },
  );

  it('does not treat a missing download as successful media', async () => {
    const storage = new AiStorage(
      config as never,
      jest.fn(() =>
        Promise.resolve(Response.json({ code: 'NoSuchKey', statusCode: '404' }, { status: 400 })),
      ),
    );
    await expect(storage.download(key, 44)).rejects.toThrow('VOICE_STORAGE_UNAVAILABLE');
  });

  it('bounds a stalled download body and cancels its reader', async () => {
    jest.useFakeTimers();
    const cancel = jest.fn();
    const storage = new AiStorage(
      config as never,
      jest.fn(() =>
        Promise.resolve(
          new Response(new ReadableStream({ cancel }), { headers: { 'content-length': '44' } }),
        ),
      ),
    );
    const result = expect(storage.download(key, 44)).rejects.toThrow('VOICE_STORAGE_UNAVAILABLE');
    await jest.advanceTimersByTimeAsync(10_001);
    await result;
    expect(cancel).toHaveBeenCalled();
    jest.useRealTimers();
  });
  it.each([
    ['expected_size', 0, new Response(Buffer.alloc(44))],
    ['header_missing', 44, new Response(Buffer.alloc(44))],
    [
      'declared_length',
      44,
      new Response(Buffer.alloc(44), { headers: { 'content-length': '43' } }),
    ],
    ['response_body', 44, new Response(null, { headers: { 'content-length': '44' } })],
    [
      'stream_overflow',
      44,
      new Response(Buffer.alloc(45), { headers: { 'content-length': '44' } }),
    ],
    ['stream_length', 44, new Response(Buffer.alloc(43), { headers: { 'content-length': '44' } })],
  ] as const)(
    'identifies only the fixed %s rejection stage without changing its public failure',
    async (stage, expectedBytes, response) => {
      const storage = new AiStorage(
        config as never,
        jest.fn(() => Promise.resolve(response)),
      );
      await expect(storage.download(key, expectedBytes)).rejects.toMatchObject({
        message: 'VOICE_MEDIA_INVALID',
        cause: stage,
      });
    },
  );

  it('preserves the Storage API prefix for the relative signed upload URL returned by Supabase', async () => {
    const token = 'signed-token-fixture';
    const path = `/object/upload/sign/voice-temp/${key}?token=${token}`;
    const storage = new AiStorage(
      config as never,
      jest.fn(() => Promise.resolve(new Response(JSON.stringify({ url: path, token })))),
    );
    await expect(storage.signedUpload(key, 300, 'audio/wav')).resolves.toMatchObject({
      url: `https://storage.example.test/storage/v1${path}`,
      token,
      headers: { 'content-type': 'audio/wav' },
    });
  });

  it('signs, streams an exact-size object, and permits idempotent purge without exposing the credential', async () => {
    const audio = Buffer.alloc(44);
    audio.write('RIFF');
    audio.write('WAVE', 8);
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: `/signed/${key}`, token: 'signed-token-fixture' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(audio, { status: 200, headers: { 'content-length': '44' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const storage = new AiStorage(config as never, fetcher);
    await expect(storage.signedUpload(key, 300, 'audio/wav')).resolves.toMatchObject({
      url: `https://storage.example.test/signed/${key}`,
      token: 'signed-token-fixture',
      headers: { 'content-type': 'audio/wav' },
    });
    await expect(storage.download(key, 44)).resolves.toEqual(audio);
    await expect(storage.delete(key)).resolves.toBeUndefined();
    const calls = fetcher.mock.calls as Array<[RequestInfo | URL, RequestInit?]>;
    expect(
      calls.every(
        ([, init]) =>
          new Headers(init?.headers).get('authorization') === 'Bearer service-role-fixture',
      ),
    ).toBe(true);
  });

  it('rejects cross-origin signatures, caller-selected keys, and oversized streams', async () => {
    const crossOrigin = new AiStorage(
      config as never,
      jest.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ url: 'https://evil.test/upload', token: 'signed-token-fixture' }),
          ),
        ),
      ),
    );
    await expect(crossOrigin.signedUpload(key, 300, 'audio/wav')).rejects.toThrow(
      'VOICE_STORAGE_UNAVAILABLE',
    );
    await expect(new AiStorage(config as never, jest.fn()).delete('../secret')).rejects.toThrow(
      'VOICE_STORAGE_INVALID',
    );
    const storage = new AiStorage(
      config as never,
      jest.fn(() => Promise.resolve(new Response(Buffer.alloc(45)))),
    );
    await expect(storage.download(key, 44)).rejects.toThrow('VOICE_MEDIA_INVALID');
  });
});
