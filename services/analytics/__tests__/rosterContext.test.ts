import { rosterContext } from '../rosterContext';
import { createTeam } from '../../teams';
import { SAMPLE_PLAYERS } from '../../../constants/sampleTeam';

it('separates empty, sample, and personal rosters using counts only', () => {
  expect(rosterContext(null)).toMatchObject({ roster_kind: 'empty', roster_count: 0 });
  expect(rosterContext(createTeam({ players: SAMPLE_PLAYERS }))).toMatchObject({ roster_kind: 'sample', roster_count: 16 });
  const personal = rosterContext(createTeam({ name: 'Private name', players: [SAMPLE_PLAYERS[0]] }));
  expect(personal).toMatchObject({ roster_kind: 'personal', roster_count: 1, linked_roster_count: 1 });
  expect(JSON.stringify(personal)).not.toMatch(/Private name|McDavid|8478402/);
});
