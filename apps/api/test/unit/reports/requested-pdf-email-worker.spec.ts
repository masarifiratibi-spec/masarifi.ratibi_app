import { ReportsWorker } from '../../../src/reports/reports.worker';
import { ReportsRepository } from '../../../src/reports/reports.repository';

const acceptedAfter = '2026-10-31T09:00:00.000Z';

test('the requested-email poll selects only its scoped RPC and never scans legacy or scheduled work', async () => {
  const repository = {
    listRequestedPdfEmailWork: jest.fn().mockResolvedValue([]),
    listWork: jest.fn(),
    listDueSchedules: jest.fn(),
    withWorkLock: jest.fn(),
  };
  const config = { getRequired: () => 25 };
  const worker = new ReportsWorker(repository as never, {} as never, config as never);
  await worker.runRequestedPdfEmailsOnce(acceptedAfter);
  expect(repository.listRequestedPdfEmailWork.mock.calls).toEqual([
    ['report.generate', 25, acceptedAfter],
    ['report.email.deliver', 25, acceptedAfter],
  ]);
  expect(repository.listWork).not.toHaveBeenCalled();
  expect(repository.listDueSchedules).not.toHaveBeenCalled();
  expect(repository.withWorkLock).not.toHaveBeenCalled();
});

test('an overlapping email poll shares the existing single-flight fence', async () => {
  let release!: (ids: string[]) => void;
  const first = new Promise<string[]>((resolve) => {
    release = resolve;
  });
  const repository = {
    listRequestedPdfEmailWork: jest.fn().mockReturnValueOnce(first).mockResolvedValue([]),
  };
  const worker = new ReportsWorker(
    repository as never,
    {} as never,
    { getRequired: () => 25 } as never,
  );
  const running = worker.runRequestedPdfEmailsOnce(acceptedAfter);
  await worker.runRequestedPdfEmailsOnce(acceptedAfter);
  expect(repository.listRequestedPdfEmailWork).toHaveBeenCalledTimes(1);
  release([]);
  await running;
  expect(repository.listRequestedPdfEmailWork).toHaveBeenCalledTimes(2);
});

test.each(['', 'not-a-date', '2026-02-30T00:00:00.000Z'])(
  'rejects an invalid acceptance floor before any queue access: %s',
  async (cutoff) => {
    const repository = { listRequestedPdfEmailWork: jest.fn() };
    const worker = new ReportsWorker(repository as never, {} as never, {} as never);
    await expect(worker.runRequestedPdfEmailsOnce(cutoff)).rejects.toThrow(
      'REPORT_EMAIL_SCOPE_INVALID',
    );
    expect(repository.listRequestedPdfEmailWork).not.toHaveBeenCalled();
  },
);

test('the repository requests only the new read-only worker selection function', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [{ id: 'selected-email-request' }] });
  const repository = new ReportsRepository({
    withClient: (action: (client: { query: typeof query }) => unknown) => action({ query }),
  } as never);
  await expect(
    repository.listRequestedPdfEmailWork('report.generate', 25, acceptedAfter),
  ).resolves.toEqual(['selected-email-request']);
  expect(query).toHaveBeenNthCalledWith(1, 'begin read only');
  expect(query).toHaveBeenCalledWith(
    'select * from private.list_requested_pdf_email_work($1,$2,$3::timestamptz)',
    ['report.generate', 25, acceptedAfter],
  );
  expect(query).toHaveBeenLastCalledWith('commit');
});
