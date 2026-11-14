import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import PDFDocument from 'pdfkit';

import { neutralizeCsvCell, renderReport } from '../../../src/reports/reports.renderer';
import type { ReportSnapshot } from '../../../src/reports/reports.schemas';
import { writeReportPdf } from '../../../src/reports/reports.pdf';

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const snapshot: ReportSnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-09-04T00:00:00.000Z',
  ledgerVersion: 9,
  reportType: 'financial_summary',
  period: {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    timezone: 'Asia/Riyadh',
    kind: 'monthly',
  },
  format: 'json',
  delivery: 'download',
  currencyCode: 'SAR',
  dataState: 'complete',
  evidence: [{ kind: 'ledger', version: 9, asOf: '2026-09-04T00:00:00.000Z' }],
  summary: { incomeMinor: 100, expenseMinor: 40, netCashFlowMinor: 60 },
  breakdowns: [],
  detailedRows: [
    {
      occurredAt: '2026-08-01T00:00:00.000Z',
      kind: '=cmd',
      amountMinor: 100,
      currencyCode: 'SAR',
      categoryLabel: 'طعام',
    },
  ],
};

describe('report renderer', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('neutralizes dangerous CSV prefix %s', (prefix) => {
    expect(neutralizeCsvCell(`${prefix}payload`)).toBe(`'${prefix}payload`);
  });

  it('renders stable bounded JSON and CSV from the immutable snapshot', async () => {
    const json = renderReport(snapshot, 'json', 1_000_000);
    expect(json.contentType).toBe('application/json');
    expect((await readAll(json.body)).toString('utf8')).toContain('"ledgerVersion":9');
    expect((await json.byteCounter).sha256).toMatch(/^[a-f0-9]{64}$/);

    const csv = renderReport(snapshot, 'csv', 1_000_000);
    expect(csv.contentType).toBe('text/csv; charset=utf-8');
    const csvBody = await readAll(csv.body);
    expect(csvBody.toString('utf8')).toContain("'=cmd");
    expect(csvBody.toString('utf8')).toContain('طعام');
    expect(await readAll(renderReport(snapshot, 'csv', 1_000_000).body)).toEqual(csvBody);
  });

  it('embeds the packaged Arabic font and rejects output overflow', async () => {
    const font = readFileSync(
      join(process.cwd(), '../mobile/assets/fonts/IBMPlexSansArabic-Regular.ttf'),
    );
    const pdf = renderReport(snapshot, 'pdf', 1_000_000, font);
    const pdfBody = await readAll(pdf.body);
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdfBody.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBody.length).toBeGreaterThan(1_000);
    expect(() => renderReport(snapshot, 'json', 20)).toThrow('REPORT_LIMIT_EXCEEDED');
  });

  it('does not create filenames or headers from snapshot content', () => {
    const report = renderReport({ ...snapshot, reportType: 'account_activity' }, 'json', 1_000_000);
    expect(report.extension).toBe('json');
    expect(report.contentType).not.toMatch(/[\r\n]/);
  });

  it('rejects both the PDF output stream and byte counter when the generated file exceeds the limit', async () => {
    const font = readFileSync(
      join(process.cwd(), '../mobile/assets/fonts/IBMPlexSansArabic-Regular.ttf'),
    );
    const report = renderReport(snapshot, 'pdf', 5_000, font);
    const completed = await Promise.allSettled([readAll(report.body), report.byteCounter]);
    for (const outcome of completed) {
      expect(outcome.status).toBe('rejected');
      if (outcome.status === 'rejected') {
        const failure: unknown = outcome.reason;
        expect(failure).toMatchObject({ message: 'REPORT_LIMIT_EXCEEDED' });
      }
    }
  });

  it('lets unrelated event-loop work run before a long PDF finishes drawing', async () => {
    const font = readFileSync(
      join(process.cwd(), '../mobile/assets/fonts/IBMPlexSansArabic-Regular.ttf'),
    );
    const document = new PDFDocument({ size: 'A4', margin: 48 });
    document.registerFont('report', font).font('report');
    document.resume();
    let completed = false;
    const pending = Promise.resolve(
      writeReportPdf(document, {
        ...snapshot,
        reportType: 'account_activity',
        detailedRows: Array.from({ length: 200 }, () => snapshot.detailedRows[0] ?? {}),
      }),
    ).then(() => {
      completed = true;
    });
    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(completed).toBe(false);
    } finally {
      await pending;
      document.end();
    }
  });

  it('settles rendering evidence when the consumer closes without an error', async () => {
    const font = readFileSync(
      join(process.cwd(), '../mobile/assets/fonts/IBMPlexSansArabic-Regular.ttf'),
    );
    const report = renderReport(snapshot, 'pdf', 1_000_000, font);
    if (!(report.body instanceof Readable)) throw new Error('readable stream required');
    report.body.destroy();
    await expect(report.byteCounter).rejects.toThrow('REPORT_RENDER_CANCELLED');
  }, 1_000);
});
