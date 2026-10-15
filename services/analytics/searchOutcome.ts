/** A common count-only payload for roster search surfaces; search text is never an input. */
export function searchOutcome(input: {
  queryLength: number;
  durationMs: number;
  result: 'success' | 'error';
  results?: number;
  list: string;
  source: string;
}) {
  return {
    query_length: input.queryLength, duration_ms: input.durationMs,
    result: input.result, list: input.list, source: input.source,
    ...(input.results === undefined ? {} : { results: input.results }),
  };
}
