import { ROOM_NAME_MAX } from '../../../types/league';
import { cleanRoomText, FALLBACK_TEAM_NAME, roomTeamName, roomTextMessage } from '../moderation';

describe('cleanRoomText', () => {
  it('collapses whitespace and trims', () => {
    expect(cleanRoomText('  Beer \n\t League  ')).toEqual({ ok: true, value: 'Beer League' });
  });

  it('strips control and invisible characters (zero-width, bidi overrides)', () => {
    expect(cleanRoomText('Beer\u0000 Lea​gue‮')).toEqual({ ok: true, value: 'Beer League' });
  });

  it('keeps emoji next to words', () => {
    expect(cleanRoomText('🔥 Beer League')).toEqual({ ok: true, value: '🔥 Beer League' });
  });

  it('treats blank, emoji-only and punctuation-only names as empty', () => {
    for (const input of ['', '   ', '🔥🔥🔥', '👨‍👩‍👧 🏒', '!!!', '​​', null, undefined]) {
      expect(cleanRoomText(input)).toEqual({ ok: false, reason: 'empty' });
    }
  });

  it('counts characters like Postgres, so an emoji is one', () => {
    const atLimit = `${'a'.repeat(ROOM_NAME_MAX - 1)}🔥`;
    expect(cleanRoomText(atLimit)).toEqual({ ok: true, value: atLimit });
    expect(cleanRoomText(`${atLimit}b`)).toEqual({ ok: false, reason: 'too_long' });
    expect(cleanRoomText('abcdef', 5)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('allows names in other scripts', () => {
    expect(cleanRoomText('Хоккей 2026').ok).toBe(true);
    expect(cleanRoomText('アイスホッケー').ok).toBe(true);
  });
});

describe('blocked words', () => {
  it.each(['Fuck Bettman', 'FUCKERS United', 'Shitty Snipers', 'Bitch Please', 'Kick Ass', 'Big Dicks'])('blocks %s', (name) => {
    expect(cleanRoomText(name)).toEqual({ ok: false, reason: 'blocked' });
  });

  it('sees through leetspeak, stretched letters, accents and spelled-out letters', () => {
    for (const name of ['Sh1t Show', 'fuuuuck', 'F.U.C.K. Bettman', 'f u c k', 'Fück It', 'a$$ kickers', '5h!7', 'xXn1gg3rXx']) {
      expect(cleanRoomText(name)).toEqual({ ok: false, reason: 'blocked' });
    }
  });

  it('leaves ordinary words, places and hockey names alone', () => {
    const fine = [
      'Assist Kings',
      'Bass Pro Pucks',
      'Spice Line',
      'Raccoon City',
      'Hancock Hitters',
      'Dickinson Fan Club',
      'Cockburn Crew',
      'Puck Bunnies',
      'Shift Happens',
      'Push It Real Good',
      'Niger Valley Hockey',
      'Team 2025',
    ];
    for (const name of fine) expect(cleanRoomText(name)).toEqual({ ok: true, value: name });
  });
});

describe('roomTeamName', () => {
  it('tidies a usable name', () => {
    expect(roomTeamName('  Zach   Attack ')).toBe('Zach Attack');
  });

  it('clips a long device name to fit instead of failing the sync', () => {
    expect(roomTeamName('a'.repeat(ROOM_NAME_MAX + 10))).toBe('a'.repeat(ROOM_NAME_MAX));
  });

  it('falls back for blank or blocked names', () => {
    expect(roomTeamName('🔥🔥')).toBe(FALLBACK_TEAM_NAME);
    expect(roomTeamName('Fuck Bettman')).toBe(FALLBACK_TEAM_NAME);
  });
});

describe('roomTextMessage', () => {
  it('explains each problem', () => {
    expect(roomTextMessage('empty')).toMatch(/letter or number/);
    expect(roomTextMessage('too_long')).toContain(String(ROOM_NAME_MAX));
    expect(roomTextMessage('blocked')).toMatch(/different name/);
  });
});
