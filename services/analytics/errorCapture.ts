/**
 * Hooks uncaught JS errors and unhandled promise rejections so they reach analytics.
 * The previous global handler still runs afterwards, so React Native's own crash
 * behaviour (red box in dev, native crash report in release) is unchanged.
 */

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

export interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

interface RejectionTrackerOptions {
  allRejections: boolean;
  onUnhandled: (id: number, reason: unknown) => void;
  onHandled: (id: number) => void;
}

export interface HermesLike {
  enablePromiseRejectionTracker?: (options: RejectionTrackerOptions) => void;
}

export type ErrorKind = 'crash' | 'error' | 'unhandled_rejection';
export type ReportError = (error: Error, kind: ErrorKind) => void;

export function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : JSON.stringify(value) ?? String(value));
}

/**
 * Installs the hooks once and returns a function that removes the global handler.
 * `hermes` is only passed in release builds: in dev React Native owns rejection
 * tracking for LogBox, and enabling it again would replace that.
 */
export function installErrorCapture(report: ReportError, errorUtils: ErrorUtilsLike | undefined, hermes?: HermesLike): () => void {
  const safeReport = (error: Error, kind: ErrorKind) => {
    try {
      report(error, kind);
    } catch {
      // Reporting must never turn one error into two.
    }
  };

  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, reason) => safeReport(asError(reason), 'unhandled_rejection'),
    onHandled: () => {},
  });

  if (!errorUtils) return () => {};
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    safeReport(asError(error), isFatal ? 'crash' : 'error');
    previous(error, isFatal);
  });
  return () => errorUtils.setGlobalHandler(previous);
}
