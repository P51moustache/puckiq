/**
 * Development-only logger utility
 * Logs are completely disabled in production builds for performance
 */

const isDev = __DEV__;

export const logger = {
  log: (message: string, ...args: any[]) => {
    if (isDev) console.log(message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (isDev) console.debug(message, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (isDev) console.info(message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (isDev) console.warn(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    // Always log errors, but could be sent to error tracking service in production
    console.error(message, ...args);
  },
};

export default logger;
