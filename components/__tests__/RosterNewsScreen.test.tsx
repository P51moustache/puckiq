jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Linking: { openURL: jest.fn() },
    StyleSheet: { create: (s: any) => s },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseRosterNews = jest.fn();
jest.mock('../../hooks/useRosterNews', () => ({
  useRosterNews: () => mockUseRosterNews(),
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import RosterNewsScreen from '../RosterNewsScreen';

function render() {
  let tree: any;
  act(() => { tree = create(<RosterNewsScreen />); });
  return tree;
}

function findByTestId(root: any, testID: string): any[] {
  return root.root.findAll(
    (node: any) => node.props.testID === testID && typeof node.type === 'string',
  );
}

function getAllText(root: any): string[] {
  const texts: string[] = [];
  root.root.findAll((node: any) => {
    if (node.type === 'Text' && typeof node.props.children === 'string') {
      texts.push(node.props.children);
    }
    return false;
  });
  return texts;
}

describe('RosterNewsScreen', () => {
  it('shows empty roster CTA', () => {
    mockUseRosterNews.mockReturnValue({
      isLoading: false,
      hasRoster: false,
      items: [],
      error: null,
      onRefresh: jest.fn(),
    });
    const tree = render();
    expect(findByTestId(tree, 'news-empty-roster')).toHaveLength(1);
    expect(findByTestId(tree, 'news-go-roster')).toHaveLength(1);
  });

  it('renders only stories matched to roster players', () => {
    mockUseRosterNews.mockReturnValue({
      isLoading: false,
      hasRoster: true,
      items: [{
        id: '1',
        title: 'McDavid placed on IR',
        url: 'https://example.com',
        summary: 'Edmonton',
        publishedAt: 'Sat, 22 Aug 2026',
        source: 'ESPN NHL',
        matchedPlayerIds: [8478402],
        matchedPlayerNames: ['Connor McDavid'],
      }],
      error: null,
      onRefresh: jest.fn(),
    });
    const tree = render();
    expect(findByTestId(tree, 'roster-news-card')).toHaveLength(1);
    expect(getAllText(tree)).toContain('McDavid placed on IR');
    expect(getAllText(tree)).toContain('Connor McDavid');
  });
});
