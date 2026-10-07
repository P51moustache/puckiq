import { codeFromLink, inviteDeepLink, inviteMessage, inviteUrl, isValidRoomCode, normalizeRoomCode } from '../codes';

describe('normalizeRoomCode', () => {
  it('upper-cases and drops separators', () => {
    expect(normalizeRoomCode(' abc-234 ')).toBe('ABC234');
  });

  it('drops look-alikes that are never in a code (O, 0, I, 1)', () => {
    expect(normalizeRoomCode('O0I1abc')).toBe('ABC');
  });
});

describe('isValidRoomCode', () => {
  it('accepts exactly six canonical characters', () => {
    expect(isValidRoomCode('ABC234')).toBe(true);
    expect(isValidRoomCode('ZZZZ99')).toBe(true);
  });

  it('rejects lower case, wrong lengths and characters outside the alphabet', () => {
    expect(isValidRoomCode('abc234')).toBe(false);
    expect(isValidRoomCode('ABC23')).toBe(false);
    expect(isValidRoomCode('ABC2345')).toBe(false);
    expect(isValidRoomCode('ABC10O')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });
});

describe('invite links', () => {
  it('builds the web link and the deep link from a normalised code', () => {
    expect(inviteUrl('abc234')).toBe('https://p51moustache.github.io/puckiq/join.html?code=ABC234');
    expect(inviteDeepLink('ABC234')).toBe('puckiq://join/ABC234');
  });

  it('reads the code back out of both links', () => {
    expect(codeFromLink(inviteUrl('ABC234'))).toBe('ABC234');
    expect(codeFromLink(inviteDeepLink('ABC234'))).toBe('ABC234');
  });

  it('tolerates what share sheets and launchers do to links', () => {
    expect(codeFromLink('  https://p51moustache.github.io/puckiq/join.html?utm_source=sms&code=abc234#top ')).toBe('ABC234');
    expect(codeFromLink('http://P51MOUSTACHE.github.io/puckiq/join?code=ABC234')).toBe('ABC234');
    expect(codeFromLink('puckiq:///join/abc234')).toBe('ABC234');
    expect(codeFromLink('puckiq://join/ABC234/?ref=sms')).toBe('ABC234');
  });

  it('accepts a bare code typed with spaces or a dash', () => {
    expect(codeFromLink('abc 234')).toBe('ABC234');
    expect(codeFromLink('ABC-234')).toBe('ABC234');
  });

  it('rejects other sites, other routes and bad codes', () => {
    expect(codeFromLink('https://evil.example.com/puckiq/join.html?code=ABC234')).toBeNull();
    expect(codeFromLink('https://p51moustache.github.io/puckiq/join.html')).toBeNull();
    expect(codeFromLink('https://p51moustache.github.io/puckiq/join.html?code=ABC1O4')).toBeNull();
    expect(codeFromLink('puckiq://player/8478402')).toBeNull();
    expect(codeFromLink('puckiq://join/')).toBeNull();
  });

  it('never repairs a bare code by silently dropping characters', () => {
    expect(codeFromLink('ABC1234')).toBeNull();
    expect(codeFromLink('ABC23')).toBeNull();
    expect(codeFromLink('')).toBeNull();
    expect(codeFromLink(null)).toBeNull();
    expect(codeFromLink(undefined)).toBeNull();
  });
});

describe('inviteMessage', () => {
  it('names the room and carries the link and the code', () => {
    expect(inviteMessage('  Beer   League ', 'abc234')).toBe(
      'Join “Beer League” on PuckIQ.\nhttps://p51moustache.github.io/puckiq/join.html?code=ABC234\nRoom code: ABC234',
    );
  });

  it('still reads as a sentence when the room has no name', () => {
    expect(inviteMessage('   ', 'ABC234').split('\n')[0]).toBe('Join our league room on PuckIQ.');
  });
});
