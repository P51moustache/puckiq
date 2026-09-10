import { createGoogleSignIn } from '../googleAuth';

function setup() {
  const deps = {
    start: jest.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com/auth' }, error: null }),
    open: jest.fn().mockResolvedValue({ type: 'success', url: 'learningproject://auth/callback?code=test-code' }),
    exchange: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test' } } }, error: null }),
  };
  return { deps, signIn: createGoogleSignIn(deps) };
}

test('exchanges a PKCE code only for the expected callback', async () => {
  const { deps, signIn } = setup();
  expect(await signIn('learningproject://auth/callback')).toEqual({ ok: true, error: null });
  expect(deps.exchange).toHaveBeenCalledWith('test-code');
});

test.each(['https://example.com/auth/callback?code=test-code',
  'learningproject://auth/elsewhere?code=test-code',
  'learningproject://auth/callback#access_token=legacy-token',
  'learningproject://auth/callback?error=access_denied',
  'learningproject://auth/callback?code=a&code=b'])('rejects an invalid callback: %s', async url => {
  const { deps, signIn } = setup();
  deps.open.mockResolvedValue({ type: 'success', url });
  expect((await signIn('learningproject://auth/callback')).ok).toBe(false);
  expect(deps.exchange).not.toHaveBeenCalled();
});

test('cancel is quiet; browser and exchange errors produce failure', async () => {
  const { deps, signIn } = setup();
  deps.open.mockResolvedValueOnce({ type: 'cancel' });
  expect(await signIn('learningproject://auth/callback')).toEqual({ ok: false, error: null });
  deps.open.mockRejectedValueOnce(new Error('Browser unavailable'));
  expect((await signIn('learningproject://auth/callback')).error).toBe('Browser unavailable');
  deps.exchange.mockResolvedValueOnce({ error: { message: 'Code expired' }, data: { session: null } });
  expect((await signIn('learningproject://auth/callback')).error).toBe('Code expired');
});

test('two taps do not overwrite the in-flight PKCE verifier', async () => {
  const { deps, signIn } = setup();
  let finish!: (value: { type: string }) => void;
  deps.open.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const first = signIn('learningproject://auth/callback');
  await Promise.resolve();
  expect((await signIn('learningproject://auth/callback')).ok).toBe(false);
  expect(deps.start).toHaveBeenCalledTimes(1);
  finish({ type: 'cancel' });
  await first;
  expect((await signIn('learningproject://auth/callback')).ok).toBe(true);
});
