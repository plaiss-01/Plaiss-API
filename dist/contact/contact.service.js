"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ContactService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
let ContactService = ContactService_1 = class ContactService {
    configService;
    logger = new common_1.Logger(ContactService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    async sendContactMessage(dto) {
        const { name, email, company, reason, message } = dto;
        const receiverEmail = this.configService.get('CONTACT_RECEIVER_EMAIL') || 'hello@plaiss.com';
        const smtpHost = this.configService.get('SMTP_HOST');
        const smtpPort = parseInt(this.configService.get('SMTP_PORT') || '587', 10);
        const smtpUser = this.configService.get('SMTP_USER');
        const smtpPass = this.configService.get('SMTP_PASS');
        const fromEmail = this.configService.get('SMTP_FROM_EMAIL') || `"Plaiss Contact Form" <no-reply@plaiss.com>`;
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
        if (!smtpHost || !smtpUser) {
            this.logger.warn(`SMTP configuration is incomplete (SMTP_HOST/SMTP_USER missing). Logging contact submission to console:`);
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
                secure: smtpPort === 465,
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
        }
        catch (error) {
            this.logger.error(`Failed to send contact email to ${receiverEmail}:`, error);
            throw new common_1.InternalServerErrorException('Failed to send contact email. Please try again later.');
        }
    }
};
exports.ContactService = ContactService;
exports.ContactService = ContactService = ContactService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ContactService);
//# sourceMappingURL=contact.service.js.map