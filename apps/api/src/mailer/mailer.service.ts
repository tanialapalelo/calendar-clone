import { Injectable } from '@nestjs/common';
import type { Event } from '@prisma/client';

@Injectable()
export class MailerService {
  // In MVP mode we log invitations. Later swap this for nodemailer or external provider.
  async sendInvitation(
    ev: Partial<Event>,
    toEmail: string,
    token: string,
    ics?: string,
  ): Promise<void> {
    console.error('[MAILER STUB] sendInvitation', {
      to: toEmail,
      eventId: ev.id,
      title: ev.title,
      token,
      hasIcs: !!ics,
    });
    return Promise.resolve();
  }
}
