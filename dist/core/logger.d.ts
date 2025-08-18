import pino from 'pino';
declare class Logger {
    private logger;
    constructor();
    get pino(): pino.Logger;
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}
export declare const logger: Logger;
export {};
