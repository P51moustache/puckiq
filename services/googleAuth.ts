type AuthError = { message: string } | null;
interface GoogleAuthDependencies {
  start: (redirectTo: string) => Promise<{ data: { url?: string | null }; error: AuthError }>;
  open: (url: string, redirectTo: string) => Promise<{ type: string; url?: string }>;
  exchange: (code: string) => Promise<{ data: { session: unknown }; error: AuthError }>;
}

/** One browser flow at a time: Supabase stores one PKCE verifier per client. */
export function createGoogleSignIn(deps: GoogleAuthDependencies) {
  let inFlight = false;
  return async (redirectTo: string): Promise<{ ok: boolean; error: string | null }> => {
    if (inFlight) return { ok: false, error: null };
    inFlight = true;
    try {
      const { data, error } = await deps.start(redirectTo);
      if (error) throw new Error(error.message);
      if (!data.url) throw new Error('Google sign-in could not open. Please try again.');
      const result = await deps.open(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') return { ok: false, error: null };
      if (result.type !== 'success' || !result.url) throw new Error('Google sign-in did not complete.');
      const expected = new URL(redirectTo);
      const callback = new URL(result.url);
      if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname) {
        throw new Error('Unexpected sign-in callback. Please try again.');
      }
      if (callback.searchParams.has('error')) throw new Error('Google sign-in was not authorized.');
      const codes = callback.searchParams.getAll('code');
      if (codes.length !== 1 || !codes[0]) throw new Error('No valid authorization code received from Google.');
      const exchange = await deps.exchange(codes[0]);
      if (exchange.error) throw new Error(exchange.error.message);
      if (!exchange.data.session) throw new Error('Google sign-in did not create a session.');
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Google sign-in failed. Please try again.' };
    } finally {
      inFlight = false;
    }
  };
}
