class Logger {
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.NODE_ENV !== 'production';
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }

  log(...args: any[]) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (this.enabled) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    console.error(...args);
  }
}

export const logger = new Logger();

logger.log(`📝 [LOGGER] Initialized. Enabled: ${logger.isEnabled()}`);
