interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  error?: string;
  [key: string]: any;
}

class Logger {
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatMessage(level: string, message: string, context: LogContext = {}): string {
    const timestamp = new Date().toISOString();
    const requestId = context.requestId || this.generateRequestId();

    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      requestId,
      ...context
    };

    return JSON.stringify(logEntry, null, 0);
  }

  info(message: string, context: LogContext = {}) {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context: LogContext = {}) {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context: LogContext = {}) {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context: LogContext = {}) {
    console.debug(this.formatMessage('debug', message, context));
  }

  // Helper for timing operations
  time(operation: string, requestId?: string) {
    const start = Date.now();
    return {
      end: (context: LogContext = {}) => {
        const duration = Date.now() - start;
        this.info(`Completed ${operation}`, { requestId, operation, duration, ...context });
        return duration;
      }
    };
  }
}

export const logger = new Logger();

// Helper for generating request IDs
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
