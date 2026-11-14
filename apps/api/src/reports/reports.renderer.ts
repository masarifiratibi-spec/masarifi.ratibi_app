import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';

import PDFDocument from 'pdfkit';

import { parseReportSnapshot, type ReportFormat, type ReportSnapshot } from './reports.schemas';
import { writeReportPdf } from './reports.pdf';

const CSV_COLUMNS = ['occurredAt', 'kind', 'amountMinor', 'currencyCode', 'categoryLabel'] as const;

export interface RenderedReport {
  contentType: 'application/json' | 'text/csv; charset=utf-8' | 'application/pdf';
  extension: ReportFormat;
  body: NodeJS.ReadableStream;
  byteCounter: Promise<{ bytes: number; sha256: string }>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

export function neutralizeCsvCell(value: string): string {
  const normalized = value.normalize('NFKC');
  return /^[=+\-@\t\r]/.test(normalized) ? `'${normalized}` : normalized;
}

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(canonical(value))
        : typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? value.toString()
            : '';
  const safe = neutralizeCsvCell(text);
  return `"${safe.replaceAll('"', '""')}"`;
}

function* csv(snapshot: ReportSnapshot): Generator<string> {
  const type = snapshot.summary.exportType;
  const columns =
    type === 'activity'
      ? ['id', 'occurredAt', 'eventType', 'summary', 'platformScope', 'permission', 'destination']
      : type === 'overview' || type === 'platform_analytics'
        ? [
            'section',
            'metric',
            'value',
            'platformScope',
            'period',
            'observedAt',
            'timestamp',
            'freshness',
            'timezone',
            'periodStart',
            'periodEnd',
            'collectionStartedAt',
          ]
        : CSV_COLUMNS;
  yield `\uFEFF${columns.join(',')}\r\n`;
  for (const row of snapshot.detailedRows)
    yield `${columns.map((column) => csvCell(row[column])).join(',')}\r\n`;
}

function pdf(snapshot: ReportSnapshot, font: Buffer): PDFKit.PDFDocument {
  const document = new PDFDocument({
    autoFirstPage: true,
    compress: true,
    size: 'A4',
    margin: 48,
    info: {
      Title: 'Masarifi report',
      Creator: 'Masarifi',
      CreationDate: new Date(snapshot.generatedAt),
    },
  });
  document.registerFont('report', font).font('report');
  return document;
}

function bounded(
  source: Readable,
  maximumBytes: number,
): Pick<RenderedReport, 'body' | 'byteCounter'> {
  let bytes = 0;
  const hash = createHash('sha256');
  let resolveCount!: (count: { bytes: number; sha256: string }) => void;
  let rejectCount!: (error: Error) => void;
  const byteCounter = new Promise<{ bytes: number; sha256: string }>((resolve, reject) => {
    resolveCount = resolve;
    rejectCount = reject;
  });
  const output = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        callback(new Error('REPORT_LIMIT_EXCEEDED'));
        return;
      }
      hash.update(value);
      callback(null, value);
    },
    flush(callback) {
      resolveCount({ bytes, sha256: hash.digest('hex') });
      callback();
    },
  });
  output.once('error', (error: Error) => {
    rejectCount(error);
  });
  output.once('close', () => {
    if (!output.writableFinished) rejectCount(new Error('REPORT_RENDER_CANCELLED'));
    source.destroy();
  });
  source.once('close', () => {
    if (!source.readableEnded && !output.destroyed)
      output.destroy(new Error('REPORT_RENDER_CANCELLED'));
  });
  source.once('error', (error: Error) => {
    output.destroy(error);
  });
  source.pipe(output);
  return { body: output, byteCounter };
}

export function renderReport(
  input: ReportSnapshot,
  format: ReportFormat,
  maximumBytes: number,
  arabicFont?: Buffer,
): RenderedReport {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1)
    throw new Error('REPORT_LIMIT_EXCEEDED');
  let snapshot: ReportSnapshot;
  try {
    snapshot = parseReportSnapshot(input, maximumBytes);
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_SNAPSHOT_TOO_LARGE')
      throw new Error('REPORT_LIMIT_EXCEEDED');
    throw error;
  }
  let source: Readable;
  let pdfDocument: PDFKit.PDFDocument | undefined;
  let contentType: RenderedReport['contentType'];
  if (format === 'json') {
    source = Readable.from([`${JSON.stringify(canonical(snapshot))}\n`]);
    contentType = 'application/json';
  } else if (format === 'csv') {
    source = Readable.from(csv(snapshot));
    contentType = 'text/csv; charset=utf-8';
  } else {
    if (!arabicFont) throw new Error('REPORT_FONT_UNAVAILABLE');
    pdfDocument = pdf(snapshot, arabicFont);
    source = pdfDocument;
    contentType = 'application/pdf';
  }
  const output = bounded(source, maximumBytes);
  if (pdfDocument) {
    const document = pdfDocument;
    queueMicrotask(() => {
      if (document.destroyed) return;
      void writeReportPdf(document, snapshot)
        .then(() => {
          if (!document.destroyed) document.end();
        })
        .catch((error: unknown) => {
          document.destroy(error instanceof Error ? error : new Error('REPORT_RENDER_FAILED'));
        });
    });
  }
  return {
    contentType,
    extension: format,
    ...output,
  };
}
