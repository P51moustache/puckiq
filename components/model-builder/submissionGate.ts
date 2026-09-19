export interface SubmissionGate {
  run: <T>(action: () => Promise<T>) => Promise<T | undefined>;
  isBusy: () => boolean;
}

export function createSubmissionGate(): SubmissionGate {
  let busy = false;
  return {
    isBusy: () => busy,
    async run<T>(action: () => Promise<T>) {
      if (busy) return undefined;
      busy = true;
      try {
        return await action();
      } finally {
        busy = false;
      }
    },
  };
}
