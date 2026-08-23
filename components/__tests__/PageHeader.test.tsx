jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    StyleSheet: { create: (s: any) => s },
  };
});

const mockInsets = { top: 59, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import PageHeader from '../PageHeader';

function render(ui: React.ReactElement) {
  let tree: any;
  act(() => { tree = create(ui); });
  return tree;
}

describe('PageHeader', () => {
  it('pads below the status bar / Dynamic Island using safe-area insets', () => {
    const tree = render(<PageHeader title="Tonight" subtitle="Hockey only" />);
    const header = tree.root.findAll((n: any) => n.props.testID === 'page-header')[0];
    const style = header.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.paddingTop).toBe(67);
  });

  it('does not ellipsize the subtitle to one line', () => {
    const tree = render(
      <PageHeader title="Your team vs theirs" subtitle="Not a hosted league" />,
    );
    const subtitle = tree.root.findAll((n: any) => n.props.testID === 'page-header-subtitle')[0];
    expect(subtitle.props.numberOfLines).toBeUndefined();
    expect(subtitle.props.children).toBe('NOT A HOSTED LEAGUE');
  });
});
