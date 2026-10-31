import { Inject, Injectable, Optional } from '@nestjs/common';
import nodemailer from 'nodemailer';

import { PlatformConfigService } from '../platform/config/platform-config.service';
import { isReportUuid } from './reports.schemas';

export const REPORT_SMTP_TRANSPORT = 'REPORT_SMTP_TRANSPORT';

export interface MailTransport {
  sendMail(input: Record<string, unknown>): Promise<{ accepted?: unknown[]; rejected?: unknown[] }>;
}

export function createTlsMailTransport(config: PlatformConfigService): MailTransport {
  const host = config.getRequired('EMAIL_SMTP_HOST');
  const port = config.getRequired('EMAIL_SMTP_PORT');
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: {
      user: config.getRequired('EMAIL_SMTP_USERNAME'),
      pass: config.getRequired('EMAIL_SMTP_PASSWORD'),
    },
    connectionTimeout: config.getRequired('MASARIFI_EMAIL_SMTP_CONNECTION_TIMEOUT_MS'),
    greetingTimeout: config.getRequired('MASARIFI_EMAIL_SMTP_CONNECTION_TIMEOUT_MS'),
    socketTimeout: config.getRequired('MASARIFI_EMAIL_SMTP_SOCKET_TIMEOUT_MS'),
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { servername: host, minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });
}

export class ReportsSmtpError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
    public readonly ambiguous = false,
  ) {
    super(code);
  }
}

@Injectable()
export class ReportsSmtp {
  private readonly transport: MailTransport;
  private readonly from: string;
  private readonly allowedOrigin: string;
  private readonly maximumAttachmentBytes: number;

  constructor(
    config: PlatformConfigService,
    @Optional() @Inject(REPORT_SMTP_TRANSPORT) supplied?: MailTransport,
  ) {
    this.from = config.getRequired('EMAIL_FROM');
    this.allowedOrigin = new URL(config.getRequired('SUPABASE_URL')).origin;
    this.maximumAttachmentBytes = config.getRequired('MASARIFI_REPORT_MAX_BYTES');
    this.transport = supplied ?? createTlsMailTransport(config);
  }

  async send(
    attemptId: string,
    recipient: string,
    content: string | Buffer,
    now = new Date(),
  ): Promise<{ providerMessageId: string; acceptedByServerAt: string }> {
    if (
      !isReportUuid(attemptId) ||
      !/^[^\s@\r\n]+@[^\s@\r\n]+$/.test(recipient) ||
      recipient.length > 320
    )
      throw new ReportsSmtpError('REPORT_EMAIL_INVALID');
    const attachment = Buffer.isBuffer(content) ? content : null;
    let link: URL | null = null;
    if (attachment) {
      if (
        !Number.isSafeInteger(this.maximumAttachmentBytes) ||
        attachment.length > this.maximumAttachmentBytes ||
        attachment.subarray(0, 5).toString() !== '%PDF-' ||
        !attachment.subarray(-1024).toString('latin1').trimEnd().endsWith('%%EOF')
      )
        throw new ReportsSmtpError('REPORT_EMAIL_INVALID');
    } else {
      try {
        link = new URL(content as string);
      } catch {
        throw new ReportsSmtpError('REPORT_EMAIL_INVALID');
      }
      if (
        link.protocol !== 'https:' ||
        link.origin !== this.allowedOrigin ||
        !link.pathname.startsWith('/storage/v1/object/sign/report-exports/')
      )
        throw new ReportsSmtpError('REPORT_EMAIL_INVALID');
    }
    const domain = this.from.slice(this.from.lastIndexOf('@') + 1);
    const messageId = `<report-${attemptId}@${domain}>`;
    try {
      const result = await this.transport.sendMail({
        from: this.from,
        to: recipient,
        envelope: { from: this.from, to: recipient },
        subject: 'Your Masarifi report is ready',
        text: attachment
          ? 'Your requested PDF report is attached.'
          : `Your requested report is ready. This private link expires shortly:\n${link?.toString() ?? ''}`,
        messageId,
        attachments: attachment
          ? [
              {
                filename: `Masarifi-report-${attemptId}.pdf`,
                content: attachment,
                contentType: 'application/pdf',
              },
            ]
          : undefined,
      });
      const accepted = (result.accepted ?? []).some(
        (value) => String(value).toLowerCase() === recipient.toLowerCase(),
      );
      if (!accepted) throw new ReportsSmtpError('REPORT_SMTP_REJECTED');
      return { providerMessageId: messageId, acceptedByServerAt: now.toISOString() };
    } catch (error) {
      if (error instanceof ReportsSmtpError) throw error;
      const failure = error as { responseCode?: number; code?: string; command?: string };
      if (failure.code === 'ETIMEDOUT' && failure.command === 'DATA')
        throw new ReportsSmtpError('DELIVERY_ACCEPTANCE_UNKNOWN', false, true);
      if ((failure.responseCode ?? 0) >= 500) throw new ReportsSmtpError('REPORT_SMTP_REJECTED');
      throw new ReportsSmtpError('REPORT_SMTP_TRANSIENT', true);
    }
  }
}
