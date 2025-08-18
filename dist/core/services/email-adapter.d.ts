export interface EmailMessage {
    to: string;
    subject: string;
    html?: string;
    text?: string;
}
export interface EmailAdapter {
    send(message: EmailMessage): Promise<void>;
}
export declare class ConsoleEmailAdapter implements EmailAdapter {
    send(message: EmailMessage): Promise<void>;
}
