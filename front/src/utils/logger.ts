/**
 * Centralized Logger - Only active in development
 * Provides structured logging with different levels
 */

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  private enabled: boolean;

  constructor() {
    this.enabled = isDevelopment;
  }

  /**
   * Log debug information (only in development)
   */
  debug(message: string, ...args: any[]) {
    if (this.enabled) {
      console.log(`🔍 ${message}`, ...args);
    }
  }

  /**
   * Log informational messages (only in development)
   */
  info(message: string, ...args: any[]) {
    if (this.enabled) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  }

  /**
   * Log warnings (always active)
   */
  warn(message: string, ...args: any[]) {
    console.warn(`⚠️ ${message}`, ...args);
  }

  /**
   * Log errors (always active)
   */
  error(message: string, ...args: any[]) {
    console.error(`❌ ${message}`, ...args);
  }

  /**
   * Log security-related events (always active)
   */
  security(message: string, ...args: any[]) {
    console.warn(`🔒 ${message}`, ...args);
  }

  /**
   * Enable/disable logging manually
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const logger = new Logger();
