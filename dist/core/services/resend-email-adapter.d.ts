import type { EmailAdapter, EmailMessage } from './email-adapter';
export interface ResendConfig {
    apiKey: string;
    from: string;
}
export declare class ResendEmailAdapter implements EmailAdapter {
    private resend;
    private from;
    constructor(config: ResendConfig);
    send(message: EmailMessage): Promise<void>;
}
