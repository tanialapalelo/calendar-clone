import { Injectable, Logger } from '@nestjs/common';
import type { Event } from '@prisma/client';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Configure transporter lazily when first used. Respect env vars for prod SMTP.
    const host = process.env.MAIL_HOST ?? 'localhost';
    const port = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 1025;
    const user = process.env.MAIL_USER ?? undefined;
    const pass = process.env.MAIL_PASS ?? undefined;

    try {
      const opts: nodemailer.TransportOptions = user
        ? { host, port, auth: { user, pass } }
        : { host, port };
      this.transporter = nodemailer.createTransport(opts as any);
      // Verify transporter to surface connection problems early in dev/CI.
      // If verification fails we fall back to logging behavior below.
      this.transporter.verify().catch((err) => {
        this.logger.warn(
          'SMTP transporter verify failed; falling back to logger',
          String(err),
        );
        this.transporter = null;
      });
    } catch (err) {
      // Leave transporter null; sendInvitation will fallback to logging.
      this.logger.debug('Failed to create transporter, will log mails instead');
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
    const rsvpUrl = `${frontend.replace(/\/$/, '')}/invitations/${encodeURIComponent(
      token,
    )}`;
    const icsUrl = `${frontend.replace(/\/$/, '')}/invitations/${encodeURIComponent(token)}/ics`;
    const subject = `Invitation: ${ev.title ?? 'Event'}`;
    const text = `You're invited to ${ev.title ?? 'an event'}\n\nAccept: ${rsvpUrl}?rsvp=accepted\nTentative: ${rsvpUrl}?rsvp=tentative\nDecline: ${rsvpUrl}?rsvp=declined\n\nIf your mail client doesn't automatically add the calendar, you can download it here: ${icsUrl}`;
    const html = `<p>You're invited to <strong>${ev.title ?? 'an event'}</strong>.</p>
    <p><a href="${rsvpUrl}?rsvp=accepted">Accept</a> | <a href="${rsvpUrl}?rsvp=tentative">Tentative</a> | <a href="${rsvpUrl}?rsvp=declined">Decline</a></p>
    <p>If your mail client doesn't automatically add the calendar, <a href="${icsUrl}">download the .ics</a>.</p>`;

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
          attachments: ics
            ? [
                {
                  content: ics,
                  filename: 'invite.ics',
                  contentType: 'text/calendar; charset=utf-8',
                },
              ]
            : undefined,
        });
        if (process.env.DEBUG_MAILER === '1')
          this.logger.debug('[MAILER] sent invitation', {
            to: toEmail,
            eventId: ev.id,
            token,
          });
        return true;
      } catch (err) {
        this.logger.warn(
          'Mailer send failed, falling back to logging',
          String(err),
        );
        return false;
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
