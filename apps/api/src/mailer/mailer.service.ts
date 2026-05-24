import { Injectable, Logger } from '@nestjs/common';
import type { Event } from '@prisma/client';
import nodemailer from 'nodemailer';

// Minimal interface we rely on from nodemailer to avoid importing noisy types
interface SmtpTransporter {
  sendMail(options: Record<string, unknown>): Promise<unknown>;
  verify?(): Promise<void>;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: SmtpTransporter | null = null;

  constructor() {
    // Configure transporter lazily when first used. Respect env vars for prod SMTP.
    const host = process.env.MAIL_HOST ?? 'localhost';
    const port = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 1025;
    const user = process.env.MAIL_USER ?? undefined;
    const pass = process.env.MAIL_PASS ?? undefined;

    try {
      // Determine whether to use a secure connection. Default to true for port 465.
      const secureEnv = process.env.MAIL_SECURE;
      const secure =
        typeof secureEnv !== 'undefined'
          ? secureEnv === '1' || secureEnv === 'true'
          : port === 465;

      // Optional service name (e.g. 'gmail') can be provided via MAIL_SERVICE,
      // which nodemailer will map to provider defaults.
      const service = process.env.MAIL_SERVICE ?? undefined;

      // TLS options: allow opting out of strict cert validation for some environments
      const tlsRejectUnauthorized =
        process.env.MAIL_TLS_REJECT_UNAUTHORIZED !== '0';

      const baseOpts: Record<string, unknown> = {
        host,
        port,
        secure,
        tls: { rejectUnauthorized: tlsRejectUnauthorized },
      };

      const opts: Record<string, unknown> = user
        ? { ...baseOpts, auth: { user, pass }, ...(service ? { service } : {}) }
        : { ...baseOpts, ...(service ? { service } : {}) };

      const createTransport = (
        nodemailer as unknown as {
          createTransport: (opts: Record<string, unknown>) => unknown;
        }
      ).createTransport;
      this.transporter = createTransport(opts) as SmtpTransporter;
      // Verify transporter to surface connection problems early in dev/CI.
      // If verification fails we fall back to logging behavior below.
      if (this.transporter?.verify) {
        // Call verify() and attach handlers; constructor cannot be async so use promise callbacks.
        this.transporter
          .verify()
          .then(() => {
            this.logger.debug(
              `SMTP transporter configured (${host}:${port}, secure=${secure})`,
            );
          })
          .catch((err: unknown) => {
            const errMsg =
              err instanceof Error
                ? err.message
                : typeof err === 'string'
                  ? err
                  : JSON.stringify(err);
            // Helpful guidance for common Gmail authentication errors
            if (
              errMsg.includes('535') ||
              /BadCredentials|Invalid login/i.test(errMsg)
            ) {
              this.logger.warn(
                `SMTP transporter verify failed (${host}:${port}); falling back to logger - authentication error detected. If you're using Gmail please:
- enable 2-Step Verification on the Google account
- generate an App Password and set MAIL_PASS to that 16-char password
- or use port 587 with STARTTLS if 465 is blocked
See: https://support.google.com/mail/?p=BadCredentials and https://support.google.com/accounts/answer/185833`,
              );
            } else if (/self signed certificate|certificate/i.test(errMsg)) {
              this.logger.warn(
                `SMTP transporter verify failed (${host}:${port}); TLS/certificate issue: ${errMsg}. You can temporarily set MAIL_TLS_REJECT_UNAUTHORIZED=0 for dev, but do not use that in production.`,
              );
            } else {
              this.logger.warn(
                `SMTP transporter verify failed (${host}:${port}); falling back to logger`,
                errMsg,
              );
            }
            this.transporter = null;
          });
      } else {
        this.logger.debug(
          `SMTP transporter configured (${host}:${port}, secure=${secure})`,
        );
      }
    } catch (err: unknown) {
      // Leave transporter null; sendInvitation will fallback to logging.
      const errMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);
      this.logger.debug(
        'Failed to create transporter, will log mails instead',
        errMsg,
      );
      this.transporter = null;
    }
  }

  // Send an invitation email with an RSVP link. In dev use MailHog (localhost:1025).
  async sendInvitation(
    ev: Partial<Event>,
    toEmail: string,
    token: string,
    ics?: string,
  ): Promise<boolean> {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    // Use API_URL to build ICS download link (the API serves /v1/invitations/:token/ics).
    // Fallback: if API_URL is not set, try FRONTEND_URL + '/v1' (useful in simple dev setups),
    // but it's recommended to set API_URL to your API origin in production.
    const apiBase = process.env.API_URL ?? `${frontend.replace(/\/$/, '')}/v1`;
    const rsvpUrl = `${frontend.replace(/\/$/, '')}/invitations/${encodeURIComponent(
      token,
    )}`;
    const icsUrl = `${apiBase.replace(/\/$/, '')}/invitations/${encodeURIComponent(token)}/ics`;
    const subject = `Invitation: ${ev.title ?? 'Event'}`;
    const text = `You're invited to ${ev.title ?? 'an event'}\n\nAccept: ${rsvpUrl}?rsvp=accepted\nTentative: ${rsvpUrl}?rsvp=tentative\nDecline: ${rsvpUrl}?rsvp=declined\n\nIf your mail client doesn't automatically add the calendar, you can download it here: ${icsUrl}`;
    const html = `<p>You're invited to <strong>${ev.title ?? 'an event'}</strong>.</p>
    <p><a href="${rsvpUrl}?rsvp=accepted">Accept</a> | <a href="${rsvpUrl}?rsvp=tentative">Tentative</a> | <a href="${rsvpUrl}?rsvp=declined">Decline</a></p>
    <p>If your mail client doesn't automatically add the calendar, <a href="${icsUrl}">download the .ics</a>.</p>`;

    // If we have a transporter configured, prefer SMTP sending
    if (this.transporter) {
      try {
        const fromAddr =
          process.env.MAIL_FROM ??
          process.env.MAIL_USER ??
          'no-reply@example.com';
        await this.transporter.sendMail({
          from: fromAddr,
          to: toEmail,
          subject,
          text,
          html,
          // include calendar as alternative so mail clients parse meeting request
          alternatives: ics
            ? [
                {
                  content: ics,
                  contentType: 'text/calendar; method=REQUEST; charset=utf-8',
                  contentTransferEncoding: '7bit',
                },
              ]
            : undefined,
          attachments: ics
            ? [
                {
                  content: ics,
                  filename: 'invite.ics',
                  contentType: 'text/calendar; charset=utf-8',
                  contentDisposition: 'inline',
                  contentTransferEncoding: '7bit',
                },
              ]
            : undefined,
          // calendar-specific headers that help some clients
          headers: ics
            ? {
                'Content-class': 'urn:content-classes:calendarmessage',
                'X-Entity-Ref-ID': 'invite.ics',
              }
            : undefined,
        });
        if (process.env.DEBUG_MAILER === '1')
          this.logger.debug('[MAILER] sent invitation', {
            to: toEmail,
            eventId: ev.id,
            token,
          });
        return true;
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : JSON.stringify(err);
        this.logger.warn('Mailer send failed, falling back to logger', errMsg);
      }
    }

    // If Postmark token present, try Postmark HTTP API (no extra dependency)
    const postmarkToken =
      process.env.POSTMARK_API_TOKEN ?? process.env.POSTMARK_SERVER_TOKEN;
    if (postmarkToken) {
      try {
        const body: Record<string, unknown> = {
          From: process.env.MAIL_FROM ?? 'no-reply@example.com',
          To: toEmail,
          Subject: subject,
          HtmlBody: html,
          TextBody: text,
        };
        if (ics) {
          body['Attachments'] = [
            {
              Name: 'invite.ics',
              Content: Buffer.from(ics).toString('base64'),
              ContentType: 'text/calendar; charset=utf-8',
            },
          ];
        }

        const res = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': postmarkToken,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          this.logger.warn('Postmark send failed', {
            status: res.status,
            body: txt,
          });
          return false;
        }

        if (process.env.DEBUG_MAILER === '1')
          this.logger.debug('[MAILER][postmark] sent invitation', {
            to: toEmail,
            eventId: ev.id,
            token,
          });
        return true;
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : JSON.stringify(err);
        this.logger.warn('Postmark send failed', errMsg);
        // fallthrough to logging
      }
    }

    // Fallback: log the email (use debug-level to avoid noisy CI logs)
    this.logger.debug('[MAILER STUB] sendInvitation', {
      to: toEmail,
      eventId: ev.id,
      title: ev.title,
      token,
      hasIcs: !!ics,
    });
    return false;
  }
}
