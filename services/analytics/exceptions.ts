/**
 * Shapes app errors as PostHog `$exception` events so they land in Error tracking
 * (grouped into issues by type, message and stack), not as a loose custom event.
 * Pure: no I/O, so tests call it directly.
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ExceptionInput {
  name?: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  /** false for crashes caught by the global handler; true for errors the app recovered from. */
  handled: boolean;
}

interface StackFrame {
  platform: 'web:javascript';
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
}

/** Long messages can echo user input or payloads; PostHog groups on the start anyway. */
const MAX_MESSAGE_LENGTH = 500;
/** Enough frames to find the cause without sending megabytes from deep recursion. */
const MAX_FRAMES = 50;

const LEVEL: Record<ErrorSeverity, 'warning' | 'error' | 'fatal'> = {
  low: 'warning',
  medium: 'error',
  high: 'error',
  critical: 'fatal',
};

// Hermes and JSC lines: "at fn (file:1:2)", "at fn (address at file:1:2)", "at file:1:2".
const HERMES_FRAME = /^\s*at (?:(.+?) \()?(?:address at )?(.+?):(\d+):(\d+)\)?\s*$/;
// JSC/Safari lines: "fn@file:1:2".
const AT_SIGN_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

/** Parses a JS stack into PostHog frames, outermost caller first (crashing frame last). */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const match = HERMES_FRAME.exec(line) ?? AT_SIGN_FRAME.exec(line);
    if (!match) continue;
    const [, fn, filename, lineno, colno] = match;
    frames.push({
      platform: 'web:javascript',
      filename,
      function: fn || '?',
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: !filename.includes('node_modules') && filename !== 'native',
    });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames.reverse();
}

export function exceptionProperties(error: ExceptionInput): Record<string, unknown> {
  const frames = parseStack(error.stack);
  return {
    $exception_level: LEVEL[error.severity],
    $exception_list: [
      {
        type: error.name || 'Error',
        value: error.message.slice(0, MAX_MESSAGE_LENGTH),
        mechanism: { handled: error.handled, synthetic: false },
        ...(frames.length > 0 ? { stacktrace: { type: 'raw', frames } } : {}),
      },
    ],
  };
}
