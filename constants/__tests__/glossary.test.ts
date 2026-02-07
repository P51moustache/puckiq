import { GLOSSARY, getGlossaryEntry, type GlossaryEntry } from '../glossary';

describe('GLOSSARY', () => {
  it('contains all expected confidence tier entries', () => {
    expect(GLOSSARY.lock).toBeDefined();
    expect(GLOSSARY.strong).toBeDefined();
    expect(GLOSSARY.lean).toBeDefined();
    expect(GLOSSARY.tossup).toBeDefined();
  });

  it('contains all expected factor entries', () => {
    expect(GLOSSARY.h2h).toBeDefined();
    expect(GLOSSARY.mtm).toBeDefined();
    expect(GLOSSARY.rest).toBeDefined();
    expect(GLOSSARY.b2b).toBeDefined();
  });

  it('contains edge and stat entries', () => {
    expect(GLOSSARY.topEdge).toBeDefined();
    expect(GLOSSARY.confidence).toBeDefined();
    expect(GLOSSARY.winProb).toBeDefined();
    expect(GLOSSARY.xg).toBeDefined();
  });

  it('contains category entries', () => {
    expect(GLOSSARY.streak).toBeDefined();
    expect(GLOSSARY.edge).toBeDefined();
    expect(GLOSSARY.momentum).toBeDefined();
    expect(GLOSSARY.player).toBeDefined();
    expect(GLOSSARY.standings).toBeDefined();
  });

  it('each entry has required fields', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.term).toBeTruthy();
      expect(entry.explanation).toBeTruthy();
      expect(['confidence', 'factor', 'edge', 'stat', 'category']).toContain(entry.category);
    }
  });
});

describe('getGlossaryEntry', () => {
  it('returns entry for exact key', () => {
    const entry = getGlossaryEntry('lock');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('LOCK');
  });

  it('is case-insensitive', () => {
    const entry = getGlossaryEntry('LOCK');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('LOCK');
  });

  it('handles camelCase keys', () => {
    const entry = getGlossaryEntry('topEdge');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('TOP EDGE');
  });

  it('resolves aliases', () => {
    const entry = getGlossaryEntry('headtohead');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('H2H');
  });

  it('resolves back-to-back alias', () => {
    const entry = getGlossaryEntry('backtoback');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('B2B');
  });

  it('returns null for unknown key', () => {
    expect(getGlossaryEntry('nonexistent')).toBeNull();
  });

  it('strips non-alphanumeric characters', () => {
    const entry = getGlossaryEntry('toss-up');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('TOSS-UP');
  });
});
