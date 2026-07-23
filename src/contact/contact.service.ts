import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendContactMessage(dto: CreateContactSubmissionDto): Promise<{ success: boolean; message: string }> {
    const { name, email, company, reason, message } = dto;

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
                <div class="value">${name}</div>
              </div>

              <div class="field-group">
                <div class="label">Email Address</div>
                <div class="value"><a href="mailto:${email}">${email}</a></div>
              </div>

              ${company ? `
              <div class="field-group">
                <div class="label">Company</div>
                <div class="value">${company}</div>
              </div>
              ` : ''}

              <div class="field-group">
                <div class="label">Reason for Contact</div>
                <div class="value" style="font-weight: bold; color: #b8860b;">${reason}</div>
              </div>

              <div class="field-group">
                <div class="label">Message</div>
                <div class="message-box">${message}</div>
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

    // If SMTP host is not configured, log to console in dev mode
    if (!smtpHost || !smtpUser) {
      this.logger.warn(
        `SMTP configuration is incomplete (SMTP_HOST/SMTP_USER missing). Logging contact submission to console:`,
      );
      this.logger.log(`Target: ${receiverEmail}\n${textContent}`);

      return {
        success: true,
        message: 'Message received and logged (Development mode).',
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
      return {
        success: true,
        message: 'Your message has been sent successfully.',
      };
    } catch (error) {
      this.logger.error(`Failed to send contact email to ${receiverEmail}:`, error);
      throw new InternalServerErrorException('Failed to send contact email. Please try again later.');
    }
  }
}
