jest.mock('react-native', () => ({
  Platform: { select: (opts: Record<string, string>) => opts.default ?? opts.ios, OS: 'ios' },
  StyleSheet: { create: <T extends Record<string, unknown>>(styles: T): T => styles },
}));

import { theme, rinkGlass, textStyles } from '../theme';

describe('Rink Glass Design Tokens', () => {
  it('exports rinkGlass color tokens', () => {
    expect(rinkGlass.ice).toBe('#0a0e1a');
    expect(rinkGlass.blueLight).toBe('#4cc9f0');
    expect(rinkGlass.goalLight).toBe('#f72585');
    expect(rinkGlass.faceoffDot).toBe('#06d6a0');
    expect(rinkGlass.redLine).toBe('#e63946');
    expect(rinkGlass.powerPlay).toBe('#ffd60a');
  });

  it('exports glass card tokens', () => {
    expect(rinkGlass.glass).toContain('rgba');
    expect(rinkGlass.glassBorder).toContain('rgba');
  });

  it('keeps backwards-compatible theme export', () => {
    expect(theme.background).toBeDefined();
    expect(theme.card).toBeDefined();
    expect(theme.text).toBeDefined();
    expect(theme.accent).toBeDefined();
  });

  it('has a card accent color for each module type', () => {
    // Current "Stat Sheet" design intentionally uses one cyan accent for every
    // module header (semantic colors are reserved for data direction, not
    // section decoration). Assert each module is defined and uses blueLight.
    const modules = ['startSit', 'trending', 'alerts', 'waiverWire', 'matchupEdge', 'dailyInsight'] as const;
    for (const m of modules) {
      expect(rinkGlass.moduleAccents[m]).toBe(rinkGlass.blueLight);
    }
  });
});
