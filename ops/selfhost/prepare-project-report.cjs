// Run inside the existing requested-PDF worker with `node -` (no queue polling).
// This renders through deployed modules and composes MIME in memory; no SMTP send.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const liveRequire = createRequire('/app/dist/src/reports/reports.smtp.js');
const { ReportsSmtp } = liveRequire('/app/dist/src/reports/reports.smtp.js');
const { renderReport } = liveRequire('/app/dist/src/reports/reports.renderer.js');
const nodemailer = liveRequire('nodemailer');
const recipient = 'masarifi.ratibi@gmail.com';
const attemptId = '87c9bfee-7864-4b12-8a24-762f4c759786';
const hash = (body) => crypto.createHash('sha256').update(body).digest('hex');
const config = {
  getRequired(key) {
    const value = process.env[key];
    if (!value) throw new Error('SETTING_MISSING');
    return key === 'MASARIFI_REPORT_MAX_BYTES' ? Number(value) : value;
  },
};

(async () => {
  if (process.env.EMAIL_FROM?.toLowerCase() !== recipient)
    throw new Error('PROJECT_SENDER_MISMATCH');
  const snapshot = {
    schemaVersion: 1,
    generatedAt: '2026-11-14T00:00:00.000Z',
    ledgerVersion: 0,
    reportType: 'financial_summary',
    period: { startDate: '2026-11-01', endDate: '2026-11-14', timezone: 'Asia/Riyadh', kind: 'monthly' },
    format: 'pdf', delivery: 'email', currencyCode: 'SAR', dataState: 'empty',
    evidence: [], summary: { purpose: 'SMTP TEST - SYNTHETIC ONLY - NO USER DATA' },
    breakdowns: [], detailedRows: [],
  };
  const fontPath = '/app/assets/fonts/IBMPlexSansArabic-Regular.ttf';
  const report = renderReport(snapshot, 'pdf', config.getRequired('MASARIFI_REPORT_MAX_BYTES'), fs.readFileSync(fontPath));
  const chunks = [];
  for await (const chunk of report.body) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks);
  await report.byteCounter;
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, disableFileAccess: true, disableUrlAccess: true });
  let eml;
  let messageId;
  const smtp = new ReportsSmtp(config, {
    async sendMail(input) {
      if (input.to !== recipient || input.envelope?.to !== recipient || input.cc || input.bcc)
        throw new Error('PROJECT_RECIPIENT_ONLY');
      const result = await stream.sendMail({ ...input, date: new Date(snapshot.generatedAt) });
      eml = result.message;
      messageId = input.messageId;
      return { accepted: [recipient], rejected: [] }; // In-memory adapter only.
    },
  });
  await smtp.send(attemptId, recipient, pdf);
  process.stdout.write(JSON.stringify({
    state: 'prepared-not-sent', recipient, attemptId, messageId,
    subject: 'Your Masarifi report is ready',
    text: 'Your requested PDF report is attached.',
    filename: `Masarifi-report-${attemptId}.pdf`,
    pdfBytes: pdf.length, pdfSha256: hash(pdf), emlSha256: hash(eml),
    smtpModuleSha256: hash(fs.readFileSync('/app/dist/src/reports/reports.smtp.js')),
    rendererModuleSha256: hash(fs.readFileSync('/app/dist/src/reports/reports.renderer.js')),
    pdfBase64: pdf.toString('base64'), emlBase64: eml.toString('base64'),
    realSmtpSend: false, databaseAccess: false, queuePolling: false,
  }));
})().catch(() => { console.error('PROJECT_REPORT_PREPARATION_FAILED'); process.exitCode = 1; });
