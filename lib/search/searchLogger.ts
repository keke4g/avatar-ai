export const searchLogger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[SEARCH DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[SEARCH INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SEARCH WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[SEARCH ERROR]', ...args);
    }
  }
};
