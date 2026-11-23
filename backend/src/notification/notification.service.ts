import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SentNotificationRecord {
  type: 'SMS' | 'EMAIL';
  recipient: string;
  content: string;
  timestamp: Date;
  messageId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly isSmsSandbox: boolean;
  private readonly isEmailSandbox: boolean;
  private readonly history: SentNotificationRecord[] = [];

  constructor(private configService: ConfigService) {
    this.isSmsSandbox =
      this.configService.get<string>('SMS_PROVIDER_MODE', 'sandbox') === 'sandbox';
    this.isEmailSandbox =
      this.configService.get<string>('EMAIL_PROVIDER_MODE', 'sandbox') === 'sandbox';
  }

  async sendSms(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; messageId: string }> {
    const messageId = `sms_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (this.isSmsSandbox) {
      this.logger.log(
        `📱 [SMS SANDBOX] To: ${phone} | MsgId: ${messageId} | Message: "${message}"`,
      );
    } else {
      // In production, integrate external SMS Gateway provider here
      this.logger.log(`📱 [SMS PROD] External SMS provider dispatched to ${phone}`);
    }

    this.history.push({
      type: 'SMS',
      recipient: phone,
      content: message,
      timestamp: new Date(),
      messageId,
    });

    return { success: true, messageId };
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<{ success: boolean; messageId: string }> {
    const messageId = `email_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (this.isEmailSandbox) {
      this.logger.log(
        `✉️ [EMAIL SANDBOX] To: ${to} | Subject: "${subject}" | Body: "${body.substring(0, 100)}..."`,
      );
    } else {
      // In production, integrate external SMTP/SendGrid provider here
      this.logger.log(`✉️ [EMAIL PROD] External Email provider dispatched to ${to}`);
    }

    this.history.push({
      type: 'EMAIL',
      recipient: to,
      content: `[${subject}] ${body}`,
      timestamp: new Date(),
      messageId,
    });

    return { success: true, messageId };
  }

  getRecentNotifications(limit = 10): SentNotificationRecord[] {
    return this.history.slice(-limit);
  }
}
