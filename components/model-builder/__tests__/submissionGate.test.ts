import { createSubmissionGate } from '../submissionGate';

it('ignores a duplicate submission until the first one settles', async () => {
  const gate = createSubmissionGate();
  let release!: () => void;
  const action = jest.fn(() => new Promise<void>(resolve => { release = resolve; }));

  const first = gate.run(action);
  const duplicate = gate.run(action);

  expect(action).toHaveBeenCalledTimes(1);
  await expect(duplicate).resolves.toBeUndefined();
  release();
  await first;

  const nextAction = jest.fn(async () => {});
  await gate.run(nextAction);
  expect(nextAction).toHaveBeenCalledTimes(1);
});
