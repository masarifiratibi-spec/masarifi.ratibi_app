import { ReportsSmtp } from '../../../src/reports/reports.smtp';
import { ReportsStorage } from '../../../src/reports/reports.storage';
import { ReportsService } from '../../../src/reports/reports.service';

const id = '99000000-0000-4000-8000-000000000001';
const pdf = Buffer.from('%PDF-1.4\nSynthetic report\n%%EOF\n');
const config = {
  getRequired: (key: string) =>
    (
      ({
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key',
        NODE_ENV: 'production',
        EMAIL_FROM: 'reports@example.test',
        MASARIFI_REPORT_MAX_BYTES: 1000,
      }) as Record<string, unknown>
    )[key],
};

test('sends the exact PDF as an in-memory attachment without a download URL', async () => {
  const transport = {
    sendMail: jest
      .fn<Promise<{ accepted: string[] }>, [Record<string, unknown>]>()
      .mockResolvedValue({ accepted: ['owner@example.test'] }),
  };
  const mail = new ReportsSmtp(config as never, transport);
  await mail.send(id, 'owner@example.test', pdf);
  expect(transport.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'owner@example.test',
      attachments: [
        { filename: `Masarifi-report-${id}.pdf`, content: pdf, contentType: 'application/pdf' },
      ],
    }),
  );
  const message = transport.sendMail.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(message.text).not.toContain('https://');
});

test.each([Buffer.from('not a PDF'), Buffer.from('%PDF-1.4\n' + 'x'.repeat(1001) + '\n%%EOF')])(
  'refuses invalid or oversized PDF attachments before SMTP',
  async (body) => {
    const transport = { sendMail: jest.fn() };
    await expect(
      new ReportsSmtp(config as never, transport).send(id, 'owner@example.test', body),
    ).rejects.toThrow('REPORT_EMAIL_INVALID');
    expect(transport.sendMail).not.toHaveBeenCalled();
  },
);

test('reads only the exact owner and attempt PDF object with a bounded body', async () => {
  const request = jest.fn().mockResolvedValue(
    new Response(pdf, {
      headers: { 'content-type': 'application/pdf', 'content-length': String(pdf.length) },
    }),
  );
  const storage = new ReportsStorage(config as never, request);
  const key = storage.key(id, 'owner', 'pdf');
  await expect(storage.readPdf(id, 'owner', key, 1000)).resolves.toEqual(pdf);
  await expect(storage.readPdf(id, 'different-owner', key, 1000)).rejects.toThrow(
    'REPORT_STORAGE_INVALID',
  );
  expect(request).toHaveBeenCalledTimes(1);
});

test.each([
  [Buffer.from('not PDF'), 'application/pdf', 'REPORT_STORAGE_INVALID'],
  [pdf, 'text/html', 'REPORT_STORAGE_INVALID'],
  [
    Buffer.from('%PDF-1.4\n' + 'x'.repeat(1001) + '\n%%EOF'),
    'application/pdf',
    'REPORT_LIMIT_EXCEEDED',
  ],
])('refuses malformed, wrong-type or oversized stored attachments', async (body, type, code) => {
  const request = jest
    .fn()
    .mockResolvedValue(new Response(body, { headers: { 'content-type': type } }));
  const storage = new ReportsStorage(config as never, request);
  await expect(storage.readPdf(id, 'owner', storage.key(id, 'owner', 'pdf'), 1000)).rejects.toThrow(
    code,
  );
});

test('rejects an oversized declared attachment before consuming it', async () => {
  const request = jest.fn().mockResolvedValue(
    new Response(pdf, {
      headers: { 'content-type': 'application/pdf', 'content-length': '2000' },
    }),
  );
  const storage = new ReportsStorage(config as never, request);
  await expect(storage.readPdf(id, 'owner', storage.key(id, 'owner', 'pdf'), 1000)).rejects.toThrow(
    'REPORT_LIMIT_EXCEEDED',
  );
});

test('cancels a stalled attachment body at the read deadline', async () => {
  jest.useFakeTimers();
  const cancel = jest.fn();
  try {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(pdf.subarray(0, 5));
      },
      cancel,
    });
    const request = jest.fn().mockResolvedValue(
      new Response(body, {
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    const storage = new ReportsStorage(config as never, request);
    const rejected = expect(
      storage.readPdf(id, 'owner', storage.key(id, 'owner', 'pdf'), 1000),
    ).rejects.toThrow('REPORT_STORAGE_UNAVAILABLE');
    await jest.advanceTimersByTimeAsync(10_001);
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('admits self-addressed email only from the verified authenticated owner identity', async () => {
  const repository = { captureSnapshot: jest.fn().mockResolvedValue({ id, status: 'scheduled' }) };
  const identity = {
    getIdentityUser: jest
      .fn()
      .mockResolvedValue({ primaryEmail: 'owner@example.test', primaryEmailVerified: true }),
  };
  const service = new ReportsService(repository as never, undefined, undefined, identity as never);
  const principal = { userId: 'owner', sessionId: 's', factorAgeSeconds: 10 };
  const command = {
    type: 'financial_summary',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    format: 'pdf',
    delivery: 'email',
    recipient: null,
  };
  await expect(
    service.createReport(principal, command, 'email-operation-id', 'r'),
  ).resolves.toMatchObject({ status: 'scheduled' });
  expect(identity.getIdentityUser).toHaveBeenCalledWith('owner');
  expect(repository.captureSnapshot).toHaveBeenCalledWith(
    principal,
    expect.objectContaining({ recipient: null, delivery: 'email' }),
    'email-operation-id',
    'r',
  );
  identity.getIdentityUser.mockResolvedValue({
    primaryEmail: 'owner@example.test',
    primaryEmailVerified: false,
  });
  await expect(
    service.createReport(principal, command, 'email-operation-id-2', 'r'),
  ).rejects.toMatchObject({ status: 403 });
  expect(repository.captureSnapshot).toHaveBeenCalledTimes(1);
});

test.each([null, 86_400])(
  'requests self-addressed PDF email without another identity challenge at factor age %s',
  async (factorAgeSeconds) => {
    const repository = { captureSnapshot: jest.fn().mockResolvedValue({ id, status: 'queued' }) };
    const identity = {
      getIdentityUser: jest
        .fn()
        .mockResolvedValue({ primaryEmail: 'owner@example.test', primaryEmailVerified: true }),
    };
    const service = new ReportsService(
      repository as never,
      undefined,
      undefined,
      identity as never,
    );
    const principal = { userId: 'owner', sessionId: 's', factorAgeSeconds };
    const body = {
      type: 'financial_summary',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      format: 'pdf',
      delivery: 'email',
      recipient: null,
    };
    await expect(
      service.createReport(principal, body, 'self-email-operation', 'r'),
    ).resolves.toMatchObject({ status: 'queued' });
    expect(repository.captureSnapshot).toHaveBeenCalledWith(
      principal,
      expect.objectContaining({ recipient: null }),
      'self-email-operation',
      'r',
    );
  },
);
