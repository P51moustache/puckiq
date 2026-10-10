jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, NativeModules: {} }));

import { parseScan, rosterScannerSupported, scanRosterScreenshots } from '../rosterScanner';

describe('rosterScanner', () => {
  it('is unsupported (and returns null) on a build without the native method', async () => {
    expect(rosterScannerSupported()).toBe(false);
    await expect(scanRosterScreenshots()).resolves.toBeNull();
  });

  it('keeps only well-formed lines from the native payload', () => {
    const json = JSON.stringify([
      [{ text: 'Connor McDavid', x: 0.1, y: 0.2, width: 0.3, height: 0.02 }, { text: 'bad', x: 'x' }, null],
      'not an image',
    ]);
    expect(parseScan(json)).toEqual([[{ text: 'Connor McDavid', x: 0.1, y: 0.2, width: 0.3, height: 0.02 }], []]);
    expect(parseScan('{')).toEqual([]);
    expect(parseScan('{"a":1}')).toEqual([]);
  });
});
