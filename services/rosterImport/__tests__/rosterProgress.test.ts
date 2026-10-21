import { FULL_LINEUP_SIZE, isPartialRoster, rosterContinueLabel } from '../rosterProgress';

it('treats fewer players than a standard lineup as partial', () => {
  expect(FULL_LINEUP_SIZE).toBe(13);
  expect(isPartialRoster(0)).toBe(false);
  expect(isPartialRoster(1)).toBe(true);
  expect(isPartialRoster(FULL_LINEUP_SIZE - 1)).toBe(true);
  expect(isPartialRoster(FULL_LINEUP_SIZE)).toBe(false);
});

it('says "for now" on the setup button until the lineup can be filled', () => {
  expect(rosterContinueLabel(0)).toBe('Add a player to continue');
  expect(rosterContinueLabel(2)).toBe('Continue with 2 for now');
  expect(rosterContinueLabel(18)).toBe('Continue with 18');
});
