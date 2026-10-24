import { AiStorage } from '../../../src/ai/ai.storage';

it('uploads exact bytes privately with server authentication and overwrite disabled', async () => {
  const bytes = Buffer.from('fictional-local-audio');
  const fetcher = jest.fn(() => Promise.resolve(new Response('{}')));
  const storage = new AiStorage(
    {
      getRequired: (key: string) =>
        key === 'SUPABASE_URL' ? 'https://storage.example.test' : 'server-fixture',
    } as never,
    fetcher,
  );
  await storage.upload(
    'voice/99000000-0000-4000-8000-000000000001/99000000-0000-4000-8000-000000000002',
    bytes,
    'audio/m4a',
  );
  const [, request] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(request.method).toBe('POST');
  expect(new Headers(request.headers).get('authorization')).toBe('Bearer server-fixture');
  expect(new Headers(request.headers).get('content-type')).toBe('audio/m4a');
  expect(new Headers(request.headers).get('x-upsert')).toBe('false');
  expect(Buffer.from(request.body as Uint8Array)).toEqual(bytes);
});
