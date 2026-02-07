/**
 * Tests for useGlossary hook logic.
 * Since hook rendering with @testing-library/react-native requires
 * the full RN transformer, we test the underlying glossary lookup
 * logic directly (which the hook delegates to).
 */
import { GLOSSARY, getGlossaryEntry } from '../../constants/glossary';

describe('useGlossary (underlying logic)', () => {
  it('getGlossaryEntry returns entry for confidence tier keys', () => {
    const lock = getGlossaryEntry('lock');
    expect(lock).not.toBeNull();
    expect(lock!.term).toBe('LOCK');
    expect(lock!.category).toBe('confidence');

    const strong = getGlossaryEntry('strong');
    expect(strong!.term).toBe('STRONG');

    const lean = getGlossaryEntry('lean');
    expect(lean!.term).toBe('LEAN');

    const tossup = getGlossaryEntry('tossup');
    expect(tossup!.term).toBe('TOSS-UP');
  });

  it('getGlossaryEntry returns entry for factor keys', () => {
    expect(getGlossaryEntry('h2h')!.term).toBe('H2H');
    expect(getGlossaryEntry('mtm')!.term).toBe('MTM');
    expect(getGlossaryEntry('rest')!.term).toBe('REST');
    expect(getGlossaryEntry('b2b')!.term).toBe('B2B');
  });

  it('getGlossaryEntry returns entry for edge keys', () => {
    expect(getGlossaryEntry('topEdge')!.term).toBe('TOP EDGE');
    expect(getGlossaryEntry('confidence')!.term).toBe('Confidence %');
    expect(getGlossaryEntry('winProb')!.term).toBe('Win Probability');
  });

  it('getGlossaryEntry returns entry for stat of night category keys', () => {
    expect(getGlossaryEntry('streak')!.term).toBe('STREAK');
    expect(getGlossaryEntry('edge')!.term).toBe('EDGE');
    expect(getGlossaryEntry('momentum')!.term).toBe('MOMENTUM');
    expect(getGlossaryEntry('player')!.term).toBe('PLAYER');
    expect(getGlossaryEntry('standings')!.term).toBe('STANDINGS');
  });

  it('returns null for unknown terms', () => {
    expect(getGlossaryEntry('xyz123')).toBeNull();
    expect(getGlossaryEntry('')).toBeNull();
  });

  it('all glossary entries have non-empty explanations', () => {
    for (const [_, entry] of Object.entries(GLOSSARY)) {
      expect(entry.explanation.length).toBeGreaterThan(10);
    }
  });
});
