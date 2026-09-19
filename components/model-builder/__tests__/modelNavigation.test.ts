import { leaveModels } from '../modelNavigation';

it('uses history when present and falls back to League for a cold entry', () => {
  const withHistory = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() };
  leaveModels(withHistory);
  expect(withHistory.back).toHaveBeenCalledTimes(1);
  expect(withHistory.replace).not.toHaveBeenCalled();

  const coldEntry = { canGoBack: jest.fn(() => false), back: jest.fn(), replace: jest.fn() };
  leaveModels(coldEntry);
  expect(coldEntry.back).not.toHaveBeenCalled();
  expect(coldEntry.replace).toHaveBeenCalledWith('/(tabs)/stats');
});
