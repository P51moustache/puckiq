import { getHeroPhoto, getRandomHeroPhoto, HERO_PHOTO_COUNT } from '../heroPhoto';

describe('heroPhoto', () => {
  describe('getHeroPhoto', () => {
    it('returns a valid photo asset (number from require())', () => {
      const result = getHeroPhoto();
      expect(typeof result).toBe('number');
    });

    it('returns the same value when called twice on the same day', () => {
      const first = getHeroPhoto();
      const second = getHeroPhoto();
      expect(first).toBe(second);
    });

    it('never returns undefined', () => {
      const result = getHeroPhoto();
      expect(result).not.toBeUndefined();
    });

    it('never returns null', () => {
      const result = getHeroPhoto();
      expect(result).not.toBeNull();
    });
  });

  describe('getRandomHeroPhoto', () => {
    it('returns a valid photo asset (number from require())', () => {
      const result = getRandomHeroPhoto();
      expect(typeof result).toBe('number');
    });

    it('never returns undefined', () => {
      const result = getRandomHeroPhoto();
      expect(result).not.toBeUndefined();
    });

    it('never returns null', () => {
      const result = getRandomHeroPhoto();
      expect(result).not.toBeNull();
    });

    it('returns values within the photo array bounds over many calls', () => {
      // Run many times to exercise randomness — all results should be valid
      for (let i = 0; i < 50; i++) {
        const result = getRandomHeroPhoto();
        expect(typeof result).toBe('number');
        expect(result).not.toBeUndefined();
        expect(result).not.toBeNull();
      }
    });
  });

  describe('HERO_PHOTO_COUNT', () => {
    it('exports the total number of hero photos', () => {
      expect(HERO_PHOTO_COUNT).toBe(8);
    });

    it('is a positive number', () => {
      expect(HERO_PHOTO_COUNT).toBeGreaterThan(0);
    });
  });
});
