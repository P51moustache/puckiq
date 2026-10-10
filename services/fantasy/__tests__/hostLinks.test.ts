import { hostLinkFor, sanitizeTeamLink } from '../hostLinks';

describe('host links', () => {
  it('keeps a pasted team page on the team’s own platform, upgraded to https', () => {
    expect(sanitizeTeamLink(' https://hockey.fantasysports.yahoo.com/hockey/12345/6 ', 'yahoo')).toBe('https://hockey.fantasysports.yahoo.com/hockey/12345/6');
    expect(sanitizeTeamLink('Check my team http://hockey.fantasysports.yahoo.com/hockey/1/2 !', 'yahoo')).toBe('https://hockey.fantasysports.yahoo.com/hockey/1/2');
    expect(sanitizeTeamLink('fantasy.espn.com/hockey/team?leagueId=1&teamId=2', 'espn')).toBe('https://fantasy.espn.com/hockey/team?leagueId=1&teamId=2');
  });

  it('drops anything that isn’t a page on that platform', () => {
    expect(sanitizeTeamLink('https://fantasy.espn.com/hockey/team?leagueId=1', 'yahoo')).toBeUndefined();
    expect(sanitizeTeamLink('https://notyahoo.com/hockey', 'yahoo')).toBeUndefined();
    expect(sanitizeTeamLink('https://yahoo.com.evil.example/hockey', 'yahoo')).toBeUndefined();
    expect(sanitizeTeamLink('my team', 'yahoo')).toBeUndefined();
    expect(sanitizeTeamLink('https://www.fantrax.com/fantasy/league/abc', 'other')).toBeUndefined();
  });

  it('opens the team page when there is one, else the platform’s hockey home; nothing for other platforms', () => {
    expect(hostLinkFor({ platform: 'yahoo', teamLink: 'https://hockey.fantasysports.yahoo.com/hockey/1/2' })).toEqual({
      name: 'Yahoo', url: 'https://hockey.fantasysports.yahoo.com/hockey/1/2', teamPage: true,
    });
    expect(hostLinkFor({ platform: 'fantrax' })).toEqual({ name: 'Fantrax', url: 'https://www.fantrax.com/', teamPage: false });
    expect(hostLinkFor({ platform: 'other' })).toBeNull();
  });
});
