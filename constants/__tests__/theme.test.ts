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

  it('has card accent colors for each module type', () => {
    expect(rinkGlass.moduleAccents.startSit).toBe(rinkGlass.faceoffDot);
    expect(rinkGlass.moduleAccents.trending).toBe(rinkGlass.goalLight);
    expect(rinkGlass.moduleAccents.alerts).toBe(rinkGlass.powerPlay);
    expect(rinkGlass.moduleAccents.waiverWire).toBe(rinkGlass.blueLight);
    expect(rinkGlass.moduleAccents.matchupEdge).toBe('#a78bfa');
    expect(rinkGlass.moduleAccents.dailyInsight).toBe('#f97316');
  });
});
