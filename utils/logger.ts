interface LoggerMeta {
  [key: string]: any;
}

interface Logger {
  info: (message: string, meta?: LoggerMeta) => void;
  debug: (message: string, meta?: LoggerMeta) => void;
  warn: (message: string, meta?: LoggerMeta) => void;
  error: (message: string, error?: Error | string | LoggerMeta) => void;
}

const logger: Logger = {
  info: (message: string, meta?: LoggerMeta): void => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  
  debug: (message: string, meta?: LoggerMeta): void => {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  
  warn: (message: string, meta?: LoggerMeta): void => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  
  error: (message: string, error?: Error | string | LoggerMeta): void => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  }
};

export { logger };