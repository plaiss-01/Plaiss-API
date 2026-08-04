import { Injectable, Logger, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

/**
 * Escapes the five HTML-significant characters. Submitted values are
 * interpolated into the notification email, so without this a visitor can
 * inject markup or links into the message our own staff open.
 */
function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class ContactService implements OnModuleInit {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Created out-of-band with raw SQL rather than in schema.prisma on purpose:
   * start.sh runs `prisma db push` on every boot, and these tables must not be
   * at the mercy of that. Idempotent, so it is a no-op once they exist.
   */
  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS contact_submissions (
          id            BIGSERIAL PRIMARY KEY,
          name          TEXT NOT NULL,
          email         TEXT NOT NULL,
          company       TEXT,
          reason        TEXT,
          message       TEXT NOT NULL,
          emailed       BOOLEAN NOT NULL DEFAULT FALSE,
          error         TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx ON contact_submissions (created_at DESC)`,
      );
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS email_subscribers (
          id            BIGSERIAL PRIMARY KEY,
          email         TEXT NOT NULL UNIQUE,
          source        TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      this.logger.log('Contact and subscriber tables verified.');
    } catch (err) {
      // Never block boot on this - the site must still serve products.
      this.logger.error('Could not verify contact/subscriber tables', err as Error);
    }
  }

  /**
   * Stores an email address for the launch mailing list. Re-submitting an
   * address is a no-op rather than an error, so the visitor never sees a
   * failure for something they already did.
   */
  async subscribe(email: string, source = 'footer'): Promise<{ success: boolean; message: string }> {
    const clean = (email || '').trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    try {
      await this.prisma.$executeRaw`
        INSERT INTO email_subscribers (email, source)
        VALUES (${clean}, ${source})
        ON CONFLICT (email) DO NOTHING
      `;
      this.logger.log(`Subscriber stored: ${clean}`);
      return { success: true, message: "Thanks! You're on the list." };
    } catch (err) {
      this.logger.error(`Failed to store subscriber ${clean}`, err as Error);
      throw new InternalServerErrorException('Could not save your email. Please try again.');
    }
  }

  async sendContactMessage(dto: CreateContactSubmissionDto): Promise<{ success: boolean; message: string }> {
    const { name, email, company, reason, message } = dto;

    // Persist BEFORE attempting delivery. Previously an unconfigured SMTP host
    // meant the enquiry existed only as a log line while the visitor was told
    // it had been sent, so every enquiry since the module shipped was lost.
    let submissionId: number | null = null;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO contact_submissions (name, email, company, reason, message)
        VALUES (${name}, ${email}, ${company ?? null}, ${reason}, ${message})
        RETURNING id
      `;
      submissionId = rows?.[0]?.id != null ? Number(rows[0].id) : null;
    } catch (err) {
      this.logger.error('Failed to store contact submission', err as Error);
    }

    const receiverEmail = this.configService.get<string>('CONTACT_RECEIVER_EMAIL') || 'hello@plaiss.com';
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || `"Plaiss Contact Form" <no-reply@plaiss.com>`;

    const emailSubject = `[Plaiss Contact Form] ${reason.toUpperCase()} Enquiry from ${name}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; color: #1a1a1a; margin: 0; padding: 20px; }
            .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e0e0e0; overflow: hidden; }
            .header { background: #1a1a1a; color: #ffffff; padding: 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; text-transform: uppercase; }
            .content { padding: 30px; }
            .field-group { margin-bottom: 18px; }
            .label { font-size: 11px; text-transform: uppercase; color: #777777; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px; }
            .value { font-size: 15px; color: #1a1a1a; }
            .message-box { background: #fafafa; border-left: 4px solid #b8860b; padding: 16px; border-radius: 4px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-top: 10px; }
            .footer { padding: 16px; text-align: center; font-size: 12px; color: #888888; background: #fafafa; border-top: 1px solid #eeeeee; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Plaiss Contact Form</h1>
            </div>
            <div class="content">
              <div class="field-group">
                <div class="label">Full Name</div>
                <div class="value">${escapeHtml(name)}</div>
              </div>

              <div class="field-group">
                <div class="label">Email Address</div>
                <div class="value"><a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a></div>
              </div>

              ${company ? `
              <div class="field-group">
                <div class="label">Company</div>
                <div class="value">${escapeHtml(company)}</div>
              </div>
              ` : ''}

              <div class="field-group">
                <div class="label">Reason for Contact</div>
                <div class="value" style="font-weight: bold; color: #b8860b;">${escapeHtml(reason)}</div>
              </div>

              <div class="field-group">
                <div class="label">Message</div>
                <div class="message-box">${escapeHtml(message)}</div>
              </div>
            </div>
            <div class="footer">
              Sent automatically from the Plaiss Website Contact Form &bull; Target: ${receiverEmail}
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
NEW CONTACT FORM SUBMISSION
---------------------------
Full Name: ${name}
Email: ${email}
Company: ${company || 'N/A'}
Reason for Contact: ${reason}

Message:
${message}
---------------------------
Sent to ${receiverEmail}
    `.trim();

    // No SMTP configured: the enquiry is already safely in contact_submissions,
    // so this is a genuine success from the visitor's point of view. It is only
    // the notification email that is missing.
    if (!smtpHost || !smtpUser) {
      this.logger.warn(
        `SMTP not configured (SMTP_HOST/SMTP_USER missing). Enquiry #${submissionId ?? '?'} stored in contact_submissions but NOT emailed.`,
      );
      this.logger.log(`Target: ${receiverEmail}\n${textContent}`);

      if (submissionId === null) {
        // Neither stored nor emailed - do not claim success.
        throw new InternalServerErrorException(
          'We could not record your message. Please email hello@plaiss.com directly.',
        );
      }

      return {
        success: true,
        message: 'Thanks — your message has been received. We’ll be in touch shortly.',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: fromEmail,
        to: receiverEmail,
        replyTo: email,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`Contact email successfully sent from ${email} to ${receiverEmail}`);
      if (submissionId !== null) {
        await this.prisma
          .$executeRaw`UPDATE contact_submissions SET emailed = TRUE WHERE id = ${submissionId}`
          .catch(() => undefined);
      }
      return {
        success: true,
        message: 'Your message has been sent successfully.',
      };
    } catch (error) {
      this.logger.error(`Failed to send contact email to ${receiverEmail}:`, error);
      if (submissionId !== null) {
        await this.prisma
          .$executeRaw`UPDATE contact_submissions SET error = ${String(
            (error as Error)?.message ?? error,
          ).slice(0, 500)} WHERE id = ${submissionId}`
          .catch(() => undefined);
        // The enquiry is stored and recoverable, so failing delivery of our own
        // notification is not the visitor's problem to retry.
        return {
          success: true,
          message: 'Thanks — your message has been received. We’ll be in touch shortly.',
        };
      }
      throw new InternalServerErrorException('Failed to send your message. Please try again later.');
    }
  }
}
