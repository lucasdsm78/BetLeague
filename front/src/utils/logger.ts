/**
 * Centralized frontend logger.
 * - debug/info: only when REACT_APP_DEBUG=true
 * - warn/error: always available
 * - automatic redaction of sensitive fields
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const DEBUG_ENABLED = process.env.REACT_APP_DEBUG === 'true';
const IS_TEST = process.env.NODE_ENV === 'test';
const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN = /token|authorization|cookie|password|secret|passwd|set-cookie/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    const maybeStatus = (error as any)?.status;
    const maybeCode = (error as any)?.code;
    const maybeRequestId = (error as any)?.requestId;

    if (maybeStatus !== undefined) serialized.status = maybeStatus;
    if (maybeCode !== undefined) serialized.code = maybeCode;
    if (maybeRequestId !== undefined) serialized.requestId = maybeRequestId;
    if (DEBUG_ENABLED && error.stack) serialized.stack = error.stack;

    return serialized;
  }

  if (isPlainObject(error)) {
    return error;
  }

  return { message: String(error) };
}

function redactValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 3) return '[truncated]';

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => redactValue(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : redactValue(nestedValue, depth + 1);
    });
    return sanitized;
  }

  return value;
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(value)] as const);

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function shouldEmit(level: LogLevel): boolean {
  if (IS_TEST) {
    return DEBUG_ENABLED;
  }
  if (level === 'debug' || level === 'info') {
    return DEBUG_ENABLED;
  }
  return true;
}

function consoleMethod(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'debug':
      return console.debug;
    case 'info':
      return console.info;
    case 'warn':
      return console.warn;
    case 'error':
    default:
      return console.error;
  }
}

export interface Logger {
  child(scope: string): Logger;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export function createLogger(scope: string): Logger {
  const emit = (level: LogLevel, message: string, context?: LogContext) => {
    if (!shouldEmit(level)) return;
    const prefix = `[${scope}] ${message}`;
    const sanitized = sanitizeContext(context);
    const log = consoleMethod(level);
    if (sanitized) {
      log(prefix, sanitized);
      return;
    }
    log(prefix);
  };

  return {
    child(childScope: string) {
      return createLogger(`${scope}.${childScope}`);
    },
    debug(message: string, context?: LogContext) {
      emit('debug', message, context);
    },
    info(message: string, context?: LogContext) {
      emit('info', message, context);
    },
    warn(message: string, context?: LogContext) {
      emit('warn', message, context);
    },
    error(message: string, context?: LogContext) {
      emit('error', message, context);
    },
  };
}

export const logger = createLogger('app');
