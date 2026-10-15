import React from 'react';
// @ts-expect-error no declaration for react-test-renderer
import { act, create } from 'react-test-renderer';
import { PaywallProvider, usePaywall } from '../PaywallProvider';
import { createTeam } from '../../services/teams';
import { SAMPLE_PLAYERS } from '../../constants/sampleTeam';
import { player } from '../../services/fantasy/__tests__/fixtures';

const mockPush = jest.fn();
let mockTeam = createTeam({});
let mockReady = true;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, ready: mockReady }) }));
jest.mock('../../services/analytics/track', () => ({ track: jest.fn() }));
jest.mock('../ProPaywall', () => ({ __esModule: true, default: (props: Record<string, unknown>) => React.createElement('ProPaywall', props) }));
let paywall: ReturnType<typeof usePaywall>;
function Probe() { paywall = usePaywall(); return null; }
let tree: any;
beforeEach(() => { mockTeam = createTeam({}); mockReady = true; jest.clearAllMocks(); act(() => { tree = create(<PaywallProvider><Probe /></PaywallProvider>); }); });
afterEach(() => act(() => tree.unmount()));
const modal = () => tree.root.findByType('ProPaywall').props;

it('redirects empty and sample promotions to personal setup, while keeping Settings restore available', () => {
  act(() => paywall.openPaywall('tonight_lineup'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/myteam', params: { setup: '1' } });
  expect(modal().visible).toBe(false);
  mockTeam = createTeam({ players: SAMPLE_PLAYERS });
  act(() => tree.update(<PaywallProvider><Probe /></PaywallProvider>));
  act(() => paywall.openPaywall('pickups'));
  expect(mockPush).toHaveBeenCalledTimes(2);
  act(() => paywall.openPaywall('settings'));
  expect(modal().visible).toBe(true);
});

it('waits for roster readiness and prevents stale opportunities from another team', () => {
  mockReady = false;
  act(() => tree.update(<PaywallProvider><Probe /></PaywallProvider>));
  act(() => paywall.openPaywall('tonight_moves'));
  expect(mockPush).not.toHaveBeenCalled();
  mockReady = true; mockTeam = createTeam({ players: [player(8478402, 'Center', 'EDM', 'C')] });
  act(() => tree.update(<PaywallProvider><Probe /></PaywallProvider>));
  const preview = { kind: 'lineup' as const, emptySlots: 2 };
  act(() => paywall.openPaywall('tonight_lineup', preview));
  expect(modal()).toMatchObject({ visible: true, opportunity: preview, team: mockTeam });
  mockTeam = { ...mockTeam, id: 'other' };
  act(() => tree.update(<PaywallProvider><Probe /></PaywallProvider>));
  expect(modal().visible).toBe(false);
});
