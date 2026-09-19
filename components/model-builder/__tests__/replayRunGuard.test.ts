import { createReplayRunGuard } from '../replayRunGuard';

it('invalidates a run when weights or range change and rejects a duplicate start', () => {
  const guard = createReplayRunGuard();
  const first = guard.begin('weights-a|30-days');
  expect(first).not.toBeNull();
  expect(guard.begin('weights-a|30-days')).toBeNull();
  expect(guard.isCurrent(first!, 'weights-a|30-days')).toBe(true);

  guard.invalidate();
  expect(guard.isCurrent(first!, 'weights-a|30-days')).toBe(false);
  expect(guard.begin('weights-b|season')).not.toBeNull();
});
