import { Resend } from 'resend';
import type { EmailAdapter, EmailMessage } from './email-adapter';

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export class ResendEmailAdapter implements EmailAdapter {
  private resend: Resend;
  private from: string;

  constructor(config: ResendConfig) {
    this.resend = new Resend(config.apiKey);
    this.from = config.from;
  }

  async send(message: EmailMessage): Promise<void> {
    const emailData: any = {
      from: this.from,
      to: message.to,
      subject: message.subject,
    };

    if (message.html) {
      emailData.html = message.html;
    }

    if (message.text) {
      emailData.text = message.text;
    }

    await this.resend.emails.send(emailData);
  }
}
