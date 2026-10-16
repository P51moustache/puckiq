import { asError, installErrorCapture, type ErrorUtilsLike } from '../errorCapture';

function fakeErrorUtils() {
  const previous = jest.fn();
  let handler: (error: unknown, isFatal?: boolean) => void = previous;
  const utils: ErrorUtilsLike = { getGlobalHandler: () => handler, setGlobalHandler: (h) => { handler = h; } };
  return { utils, previous, fire: (error: unknown, isFatal?: boolean) => handler(error, isFatal) };
}

describe('installErrorCapture', () => {
  it('reports crashes and errors, then hands them to the previous handler', () => {
    const report = jest.fn();
    const { utils, previous, fire } = fakeErrorUtils();
    installErrorCapture(report, utils);
    const boom = new Error('boom');
    fire(boom, true);
    fire('soft', false);
    expect(report).toHaveBeenNthCalledWith(1, boom, 'crash');
    expect(report).toHaveBeenNthCalledWith(2, new Error('soft'), 'error');
    expect(previous).toHaveBeenCalledWith(boom, true);
  });

  it('still calls the previous handler when reporting throws', () => {
    const { utils, previous, fire } = fakeErrorUtils();
    installErrorCapture(() => { throw new Error('report failed'); }, utils);
    fire(new Error('boom'), true);
    expect(previous).toHaveBeenCalled();
  });

  it('restores the previous handler when removed', () => {
    const { utils, previous } = fakeErrorUtils();
    const remove = installErrorCapture(jest.fn(), utils);
    remove();
    expect(utils.getGlobalHandler()).toBe(previous);
  });

  it('reports unhandled rejections when given the Hermes tracker', () => {
    const report = jest.fn();
    const enablePromiseRejectionTracker = jest.fn();
    installErrorCapture(report, undefined, { enablePromiseRejectionTracker });
    const options = enablePromiseRejectionTracker.mock.calls[0][0];
    expect(options.allRejections).toBe(true);
    options.onUnhandled(1, { code: 42 });
    expect(report).toHaveBeenCalledWith(new Error('{"code":42}'), 'unhandled_rejection');
  });
});

describe('asError', () => {
  it('keeps errors and wraps anything else', () => {
    const e = new TypeError('t');
    expect(asError(e)).toBe(e);
    expect(asError('s').message).toBe('s');
    expect(asError(undefined).message).toBe('undefined');
  });
});
