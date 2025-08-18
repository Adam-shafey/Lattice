import pino, { Logger as PinoLogger } from 'pino';

class Logger {
  private logger: PinoLogger;

  constructor() {
    const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    this.logger = pino({ level });
  }

  get pino() {
    return this.logger;
  }

  enable() {
    this.logger.level = 'debug';
  }

  disable() {
    this.logger.level = 'silent';
  }

  isEnabled() {
    return this.logger.level !== 'silent';
  }

  log(...args: any[]) {
    this.logger.info(...args);
  }

  warn(...args: any[]) {
    this.logger.warn(...args);
  }

  error(...args: any[]) {
    this.logger.error(...args);
  }
}

export const logger = new Logger();

logger.log(`📝 [LOGGER] Initialized. Level: ${logger.pino.level}`);
