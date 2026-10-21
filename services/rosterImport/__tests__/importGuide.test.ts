import { INITIAL_GUIDE, nextGuide } from '../importGuide';

it('greets someone coming back from the league app', () => {
  const away = nextGuide(INITIAL_GUIDE, 'left_for_host');
  expect(away).toBe('away');
  expect(nextGuide(away, 'came_back')).toBe('returned');
});

it('ignores a return to the app that did not start from the sheet', () => {
  expect(nextGuide('start', 'came_back')).toBe('start');
  expect(nextGuide('no_screenshots', 'came_back')).toBe('no_screenshots');
});

it('offers help after a cancelled pick, even after coming back', () => {
  expect(nextGuide('start', 'pick_cancelled')).toBe('no_screenshots');
  expect(nextGuide('returned', 'pick_cancelled')).toBe('no_screenshots');
});

it('starts over on reset', () => {
  expect(nextGuide('returned', 'reset')).toBe('start');
});
