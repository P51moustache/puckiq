/**
 * Tests for StandingsSnapshot component
 * Verifies parseStandings logic, null returns, division rendering, and toggle behavior.
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
}));

// Mock teamColors
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({ primary: '#000000', secondary: '#FFFFFF' }),
}));

// Mock useState so we can call the component directly outside of React render
let mockState = false;
jest.mock('react', () => {
  const actualReact = jest.requireActual('react');
  return {
    ...actualReact,
    useState: (initial: any) => [mockState !== undefined ? mockState : initial, jest.fn()],
  };
});

import StandingsSnapshotComponent from '../StandingsSnapshot';

const mockStandings = {
  standings: [
    { teamAbbrev: { default: 'TOR' }, wins: 30, losses: 15, otLosses: 5, points: 65, divisionName: 'Atlantic', conferenceName: 'Eastern' },
    { teamAbbrev: { default: 'FLA' }, wins: 28, losses: 17, otLosses: 5, points: 61, divisionName: 'Atlantic', conferenceName: 'Eastern' },
    { teamAbbrev: { default: 'NYR' }, wins: 27, losses: 18, otLosses: 5, points: 59, divisionName: 'Metropolitan', conferenceName: 'Eastern' },
    { teamAbbrev: { default: 'WPG' }, wins: 32, losses: 13, otLosses: 5, points: 69, divisionName: 'Central', conferenceName: 'Western' },
    { teamAbbrev: { default: 'VGK' }, wins: 29, losses: 16, otLosses: 5, points: 63, divisionName: 'Pacific', conferenceName: 'Western' },
  ],
};

// Helper to find elements by testID in a JSX tree
function findByTestID(element: any, testID: string): any {
  if (!element) return null;
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
    return null;
  }
  if (typeof element !== 'object') return null;
  if (element.props?.testID === testID) return element;

  const children = element.props?.children;
  if (children) return findByTestID(children, testID);
  return null;
}

// Helper to collect all text content from a JSX tree (returns strings and numbers)
function collectText(element: any): (string | number)[] {
  if (!element) return [];
  if (Array.isArray(element)) {
    const results: (string | number)[] = [];
    for (const child of element) {
      results.push(...collectText(child));
    }
    return results;
  }
  if (typeof element !== 'object') return [];

  const results: (string | number)[] = [];

  if (element.type === 'Text') {
    const child = element.props?.children;
    if (typeof child === 'string' || typeof child === 'number') {
      results.push(child);
    }
  }

  const children = element.props?.children;
  if (children) {
    results.push(...collectText(children));
  }
  return results;
}

// Helper to find all elements matching a testID prefix
function findAllByTestIDPrefix(element: any, prefix: string): any[] {
  if (!element) return [];
  if (Array.isArray(element)) {
    const results: any[] = [];
    for (const child of element) {
      results.push(...findAllByTestIDPrefix(child, prefix));
    }
    return results;
  }
  if (typeof element !== 'object') return [];

  const results: any[] = [];
  if (element.props?.testID?.startsWith(prefix)) {
    results.push(element);
  }

  const children = element.props?.children;
  if (children) {
    results.push(...findAllByTestIDPrefix(children, prefix));
  }
  return results;
}

describe('StandingsSnapshot', () => {
  beforeEach(() => {
    // Default to collapsed state (expanded = false)
    mockState = false;
  });

  describe('returns null for invalid data', () => {
    it('returns null when standings is null', () => {
      const element = StandingsSnapshotComponent({ standings: null });
      expect(element).toBeNull();
    });

    it('returns null when standings is undefined', () => {
      const element = StandingsSnapshotComponent({ standings: undefined });
      expect(element).toBeNull();
    });

    it('returns null when standings.standings is empty array', () => {
      const element = StandingsSnapshotComponent({ standings: { standings: [] } });
      expect(element).toBeNull();
    });
  });

  describe('renders with valid standings data', () => {
    it('renders without error', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      expect(element).toBeTruthy();
    });

    it('has testID "standings-snapshot"', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      expect(element?.props?.testID).toBe('standings-snapshot');
    });

    it('shows division names', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const allText = collectText(element);

      expect(allText).toContain('ATLANTIC');
      expect(allText).toContain('METROPOLITAN');
      expect(allText).toContain('CENTRAL');
      expect(allText).toContain('PACIFIC');
    });

    it('shows STANDINGS section header', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const allText = collectText(element);
      expect(allText).toContain('STANDINGS');
    });
  });

  describe('collapsed state (default)', () => {
    it('shows 1 team per division by default', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const teamRows = findAllByTestIDPrefix(element, 'standings-row-');

      // 4 divisions, 1 team each = 4 team rows
      expect(teamRows).toHaveLength(4);
    });

    it('shows the top team (most points) per division', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const teamRows = findAllByTestIDPrefix(element, 'standings-row-');
      const teamIDs = teamRows.map((row: any) => row.props.testID);

      // TOR leads Atlantic (65 pts), NYR leads Metropolitan (59 pts),
      // WPG leads Central (69 pts), VGK leads Pacific (63 pts)
      expect(teamIDs).toContain('standings-row-TOR');
      expect(teamIDs).toContain('standings-row-NYR');
      expect(teamIDs).toContain('standings-row-WPG');
      expect(teamIDs).toContain('standings-row-VGK');
    });

    it('does not show FLA in collapsed state (2nd in Atlantic)', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const flaRow = findByTestID(element, 'standings-row-FLA');
      expect(flaRow).toBeNull();
    });
  });

  describe('toggle button', () => {
    it('has testID "standings-toggle"', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const toggle = findByTestID(element, 'standings-toggle');
      expect(toggle).toBeTruthy();
    });

    it('shows "Show Full Standings" text in collapsed state', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const toggle = findByTestID(element, 'standings-toggle');
      const toggleText = collectText(toggle);
      expect(toggleText).toContain('Show Full Standings');
    });
  });

  describe('team stat display', () => {
    it('displays wins, losses, OT losses, and points for a team', () => {
      const element = StandingsSnapshotComponent({ standings: mockStandings });
      const torRow = findByTestID(element, 'standings-row-TOR');
      const rowText = collectText(torRow);

      expect(rowText).toContain('TOR');
      expect(rowText).toContain(30);  // wins
      expect(rowText).toContain(15);  // losses
      expect(rowText).toContain(5);   // otLosses
      expect(rowText).toContain(65);  // points
    });
  });
});
