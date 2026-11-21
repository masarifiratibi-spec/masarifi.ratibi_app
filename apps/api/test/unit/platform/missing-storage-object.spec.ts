import { isMissingStorageObject } from '../../../src/platform/storage/missing-storage-object';

describe('precise missing Storage object classification', () => {
  it.each([
    [404, null, true],
    [400, { code: 'NoSuchKey' }, true],
    [400, { code: 'NoSuchKey', statusCode: 404 }, true],
    [400, { code: 'NoSuchKey', statusCode: '404' }, true],
    [400, { code: 'NoSuchBucket', statusCode: 404 }, false],
    [400, { code: 'AccessDenied', statusCode: 404 }, false],
    [400, { error: 'Object not found', statusCode: 404 }, false],
    [400, { code: 'NoSuchKey', statusCode: 403 }, false],
    [400, { code: 'NoSuchKey', statusCode: [404] }, false],
    [400, { code: 'NoSuchKey', statusCode: null }, false],
    [400, null, false],
    [400, [], false],
    [401, { code: 'NoSuchKey' }, false],
    [403, { code: 'NoSuchKey' }, false],
    [500, { code: 'NoSuchKey' }, false],
  ])('HTTP%s with %j classifies as missing=%s', async (status, payload, missing) => {
    const response = new Response(payload === null ? null : JSON.stringify(payload), { status });
    await expect(isMissingStorageObject(response, new AbortController().signal)).resolves.toBe(
      missing,
    );
  });

  it.each(['', '{"code":"NoSuchKey"', 'not-json NoSuchKey', '"NoSuchKey"'])(
    'rejects malformed or non-object error body %j',
    async (body) => {
      await expect(
        isMissingStorageObject(new Response(body, { status: 400 }), new AbortController().signal),
      ).resolves.toBe(false);
    },
  );

  it.each([4096, 4097])('bounds the streamed response at %i bytes', async (bytes) => {
    const payload = JSON.stringify({ code: 'NoSuchKey' });
    const body = payload + ' '.repeat(bytes - Buffer.byteLength(payload));
    await expect(
      isMissingStorageObject(new Response(body, { status: 400 }), new AbortController().signal),
    ).resolves.toBe(bytes === 4096);
  });

  it('counts bytes rather than characters for multibyte error bodies', async () => {
    const body = JSON.stringify({ code: 'NoSuchKey', message: 'é'.repeat(2050) });
    await expect(
      isMissingStorageObject(new Response(body, { status: 400 }), new AbortController().signal),
    ).resolves.toBe(false);
  });

  it('does not wait for an underlying cancellation that never settles after overflow', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4097));
      },
      cancel: () => new Promise<void>(() => undefined),
    });
    await expect(
      isMissingStorageObject(new Response(body, { status: 400 }), new AbortController().signal),
    ).resolves.toBe(false);
  });
});
