import { exceptionProperties, parseStack } from '../exceptions';

const HERMES_STACK = `TypeError: undefined is not a function
    at loadRoster (address at index.ios.bundle:1:2045)
    at anonymous (http://localhost:8081/node_modules/react/cjs/react.js:12:7)
    at onPress (address at index.ios.bundle:1:9981)`;

describe('parseStack', () => {
  it('reads Hermes frames, outermost caller first', () => {
    const frames = parseStack(HERMES_STACK);
    expect(frames.map((f) => f.function)).toEqual(['onPress', 'anonymous', 'loadRoster']);
    expect(frames[2]).toEqual({ platform: 'web:javascript', filename: 'index.ios.bundle', function: 'loadRoster', lineno: 1, colno: 2045, in_app: true });
    expect(frames[1].in_app).toBe(false);
  });

  it('reads JSC frames and anonymous Hermes frames', () => {
    expect(parseStack('save@app.bundle:3:14')[0]).toMatchObject({ function: 'save', filename: 'app.bundle', lineno: 3, colno: 14 });
    expect(parseStack('    at index.ios.bundle:1:5')[0]).toMatchObject({ function: '?', filename: 'index.ios.bundle' });
  });

  it('is empty without a stack', () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack('no frames here')).toEqual([]);
  });
});

describe('exceptionProperties', () => {
  it('builds a PostHog exception list with level and mechanism', () => {
    const out = exceptionProperties({ name: 'TypeError', message: 'boom', stack: HERMES_STACK, severity: 'critical', handled: false });
    expect(out.$exception_level).toBe('fatal');
    expect(out.$exception_list).toEqual([
      expect.objectContaining({ type: 'TypeError', value: 'boom', mechanism: { handled: false, synthetic: false }, stacktrace: expect.objectContaining({ type: 'raw' }) }),
    ]);
  });

  it('defaults the type, trims long messages and drops an empty stacktrace', () => {
    const [entry] = exceptionProperties({ message: 'x'.repeat(2000), severity: 'low', handled: true }).$exception_list as Record<string, unknown>[];
    expect(entry.type).toBe('Error');
    expect((entry.value as string).length).toBe(500);
    expect(entry).not.toHaveProperty('stacktrace');
  });
});
