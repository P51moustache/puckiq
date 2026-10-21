jest.mock('react-native', () => require('../../week/__tests__/support/mocks').reactNativeMock());
jest.mock('../../coach/PlayerAvatar', () => ({ PlayerAvatar: () => null }));

import React from 'react';
import { render, unmountAll } from '../../week/__tests__/support/render';
import { allText, byTestId } from '../../week/__tests__/support/tree';
import { createTeam } from '../../../services/teams';
import type { FreeLineupCall } from '../../../services/fantasy/freeLineupCall';
import { player } from '../../../services/fantasy/__tests__/fixtures';
import { FreeLineupCallCard } from '../FreeLineupCallCard';

const team = createTeam({ players: [player(8477934, 'Leon Draisaitl', 'EDM', 'C'), player(8477939, 'William Nylander', 'TOR', 'C')] });
const call: FreeLineupCall = { kind: 'swap', startId: 8477934, benchId: 8477939, slot: 'C', estimatedGain: 1.1, saved: false };
const props = { call, team, locked: false, pending: false, onSave: jest.fn(), onOpenHost: jest.fn() };

afterEach(() => unmountAll());

describe('FreeLineupCallCard', () => {
  it('lists why it makes the call, in place of the general line', () => {
    const root = render(<FreeLineupCallCard {...props} reasons={[
      { text: 'Soft matchup: MTL allows the 2nd-most goals', tone: 'good' },
      { text: 'Nylander has a tough matchup @ BOS', tone: 'bad' },
    ]} />);
    const text = allText(root);
    expect(byTestId(root, 'free-lineup-reasons')).toHaveLength(1);
    expect(text).toContain('Soft matchup: MTL allows the 2nd-most goals');
    expect(text).toContain('Nylander has a tough matchup @ BOS');
    expect(text).not.toContain('estimated scoring value');
  });

  it('keeps the general line when there are no reasons yet', () => {
    const root = render(<FreeLineupCallCard {...props} />);
    expect(byTestId(root, 'free-lineup-reasons')).toHaveLength(0);
    expect(allText(root)).toContain('+1.1 estimated scoring value over your saved plan.');
  });
});
