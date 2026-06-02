// Mock react-native
import React from 'react';
import WaiverWireScout from '../WaiverWireScout';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  RefreshControl: 'RefreshControl',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    background: '#0a1628',
    card: '#111d33',
    text: '#e8edf5',
    subtext: '#6b7a99',
    accent: '#4f8ef7',
    subtle: '#1a2744',
    semantic: { positive: '#22c55e', negative: '#ef4444' },
  },
}));

const mockGetWaiverWireRecommendations = jest.fn();
jest.mock('../../services/fantasyProjections', () => ({
  getWaiverWireRecommendations: (...args: any[]) => mockGetWaiverWireRecommendations(...args),
}));

jest.mock('../FantasyProjectionRow', () => 'FantasyProjectionRow');

// Track state values for testing
let mockLoadingState = true;
let mockProjections: any[] = [];
let mockPositionFilter = 'All';

jest.mock('react', () => {
  const actualReact = jest.requireActual('react');
  return {
    ...actualReact,
    useState: (initial: any) => {
      // Map initial values to controlled state
      if (initial === true) return [mockLoadingState, jest.fn()]; // loading
      if (initial === false) return [false, jest.fn()]; // refreshing
      if (initial === 'All') return [mockPositionFilter, jest.fn()];
      if (Array.isArray(initial)) return [mockProjections, jest.fn()];
      return [initial, jest.fn()];
    },
    useCallback: (fn: any) => fn,
    useEffect: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Helpers to traverse rendered tree
// ---------------------------------------------------------------------------

function findByTestID(element: any, testID: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.testID === testID) return element;
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    const found = findByTestID(child, testID);
    if (found) return found;
  }
  return null;
}

function findByText(element: any, text: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.children === text) return element;
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

function findAllByType(element: any, type: string): any[] {
  const results: any[] = [];
  if (!element || typeof element !== 'object') return results;
  if (element.type === type) results.push(element);
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    results.push(...findAllByType(child, type));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeProjection(overrides: Partial<any> = {}): any {
  return {
    playerId: 8478402,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    fantasyPoints: 12.5,
    floor: 6.0,
    ceiling: 18.0,
    predGoals: 0.8,
    predAssists: 1.2,
    predSog: 4.0,
    predHits: 0.5,
    predBlocks: 0.2,
    recommendation: 'START',
    confidence: 'high',
    reason: 'Elite matchup',
    gameId: 2025020001,
    opponentAbbrev: 'VGK',
    isHome: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WaiverWireScout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWaiverWireRecommendations.mockResolvedValue([]);
    mockLoadingState = true;
    mockProjections = [];
    mockPositionFilter = 'All';
  });

  it('renders the header and title', () => {
    const element = WaiverWireScout({});
    expect(findByTestID(element, 'waiver-wire-scout')).not.toBeNull();
    expect(findByText(element, 'Waiver Wire Scout')).not.toBeNull();
    expect(findByText(element, 'Top available pickups for today')).not.toBeNull();
  });

  it('renders position filter chips', () => {
    const element = WaiverWireScout({});
    const filters = findByTestID(element, 'position-filters');
    expect(filters).not.toBeNull();

    expect(findByTestID(element, 'filter-All')).not.toBeNull();
    expect(findByTestID(element, 'filter-C')).not.toBeNull();
    expect(findByTestID(element, 'filter-LW')).not.toBeNull();
    expect(findByTestID(element, 'filter-RW')).not.toBeNull();
    expect(findByTestID(element, 'filter-D')).not.toBeNull();
    expect(findByTestID(element, 'filter-G')).not.toBeNull();
  });

  it('shows loading state when loading is true', () => {
    mockLoadingState = true;
    const element = WaiverWireScout({});
    expect(findByTestID(element, 'waiver-loading')).not.toBeNull();
    expect(findByText(element, 'Loading projections...')).not.toBeNull();
  });

  it('renders back button when onBack is provided', () => {
    const onBack = jest.fn();
    const element = WaiverWireScout({ onBack });
    const backButton = findByTestID(element, 'waiver-back');
    expect(backButton).not.toBeNull();
    expect(backButton.props.onPress).toBe(onBack);
  });

  it('does not render back button when onBack is not provided', () => {
    const element = WaiverWireScout({});
    expect(findByTestID(element, 'waiver-back')).toBeNull();
  });

  it('defaults format to yahoo', () => {
    const element = WaiverWireScout({});
    expect(findByTestID(element, 'waiver-wire-scout')).not.toBeNull();
  });

  it('renders with espn format', () => {
    const element = WaiverWireScout({ format: 'espn' });
    expect(findByTestID(element, 'waiver-wire-scout')).not.toBeNull();
  });
});

describe('WaiverWireScout - loaded state with projections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadingState = false;
    mockPositionFilter = 'All';
  });

  it('renders FantasyProjectionRow components when projections exist', () => {
    mockProjections = [
      makeProjection({ playerId: 1 }),
      makeProjection({ playerId: 2 }),
      makeProjection({ playerId: 3 }),
    ];
    const element = WaiverWireScout({});
    const rows = findAllByType(element, 'FantasyProjectionRow');
    expect(rows).toHaveLength(3);
  });

  it('passes projection data to each row', () => {
    mockProjections = [
      makeProjection({ playerId: 101, playerName: 'Test Player' }),
    ];
    const element = WaiverWireScout({});
    const rows = findAllByType(element, 'FantasyProjectionRow');
    expect(rows).toHaveLength(1);
    expect(rows[0].props.projection.playerId).toBe(101);
    expect(rows[0].props.projection.playerName).toBe('Test Player');
  });

  it('passes onPlayerPress to FantasyProjectionRow', () => {
    const onPlayerPress = jest.fn();
    mockProjections = [makeProjection({ playerId: 1 })];
    const element = WaiverWireScout({ onPlayerPress });
    const rows = findAllByType(element, 'FantasyProjectionRow');
    expect(rows[0].props.onPress).toBe(onPlayerPress);
  });

  it('shows empty state when no projections and not loading', () => {
    mockProjections = [];
    const element = WaiverWireScout({});
    expect(findByTestID(element, 'waiver-empty')).not.toBeNull();
    expect(findByText(element, 'No Projections Available')).not.toBeNull();
  });

  it('shows position-specific empty text when filter is active', () => {
    mockProjections = [];
    mockPositionFilter = 'D';
    const element = WaiverWireScout({});
    const emptyEl = findByTestID(element, 'waiver-empty');
    expect(emptyEl).not.toBeNull();
  });

  it('filters projections by position', () => {
    mockProjections = [
      makeProjection({ playerId: 1, position: 'C' }),
      makeProjection({ playerId: 2, position: 'LW' }),
      makeProjection({ playerId: 3, position: 'D' }),
    ];
    mockPositionFilter = 'C';
    const element = WaiverWireScout({});
    const rows = findAllByType(element, 'FantasyProjectionRow');
    expect(rows).toHaveLength(1);
    expect(rows[0].props.projection.position).toBe('C');
  });

  it('shows all projections when filter is All', () => {
    mockProjections = [
      makeProjection({ playerId: 1, position: 'C' }),
      makeProjection({ playerId: 2, position: 'LW' }),
      makeProjection({ playerId: 3, position: 'D' }),
    ];
    mockPositionFilter = 'All';
    const element = WaiverWireScout({});
    const rows = findAllByType(element, 'FantasyProjectionRow');
    expect(rows).toHaveLength(3);
  });
});

describe('WaiverWireScout - projection data factory', () => {
  it('creates valid projection objects', () => {
    const proj = makeProjection();
    expect(proj.playerId).toBe(8478402);
    expect(proj.fantasyPoints).toBe(12.5);
    expect(proj.position).toBe('C');
    expect(proj.recommendation).toBe('START');
    expect(proj.opponentAbbrev).toBe('VGK');
  });

  it('supports overrides', () => {
    const proj = makeProjection({ playerId: 999, position: 'G', fantasyPoints: 20.0 });
    expect(proj.playerId).toBe(999);
    expect(proj.position).toBe('G');
    expect(proj.fantasyPoints).toBe(20.0);
  });
});
