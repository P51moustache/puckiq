export const NHL_PLAYER_SEARCH_URL = 'https://search.d3.nhle.com/api/v1/search/player';
export const NHL_WEB_API = 'https://api-web.nhle.com';

function runningOnWeb(): boolean {
  if (typeof process !== 'undefined' && process.env.EXPO_OS === 'web') return true;
  return typeof window !== 'undefined'
    && typeof window.document !== 'undefined'
    && typeof window.location?.hostname === 'string';
}

function webProxyOrigin(): string | null {
  if (!runningOnWeb()) return null;
  const host = window.location.hostname;
  if (host === '127.0.0.1' || host === 'localhost') {
    return `${window.location.protocol}//${host}:8094`;
  }
  if (host.includes('tail76fc69.ts.net')) {
    return `${window.location.protocol}//${host}:8452`;
  }
  return null;
}

export function nhlPlayerSearchEndpoint(): string {
  const proxy = webProxyOrigin();
  return proxy ? `${proxy}/search/player` : NHL_PLAYER_SEARCH_URL;
}

export function nhlWebApiBase(): string {
  const proxy = webProxyOrigin();
  return proxy ? `${proxy}/nhl` : NHL_WEB_API;
}
