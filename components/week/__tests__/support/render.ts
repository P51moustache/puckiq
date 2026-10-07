/** Render and interact under react-test-renderer, inside act(). Call `unmountAll` in afterEach. */

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import type React from 'react';
import type { Node } from './tree';

// Tell React this environment wraps updates in act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Node[] = [];

/** React logs this on every create(); the suite knowingly uses the renderer, like the rest of the repo. */
const DEPRECATION = 'react-test-renderer is deprecated';

/** The rendered tree's root instance. */
export function render(element: React.ReactElement): Node {
  let tree: Node;
  const log = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith(DEPRECATION)) return;
    log(...args);
  };
  try {
    act(() => {
      tree = create(element);
    });
  } finally {
    console.error = log;
  }
  mounted.push(tree);
  return tree.root;
}

export function press(node: Node): void {
  act(() => {
    node.props.onPress();
  });
}

export function unmountAll(): void {
  while (mounted.length) {
    const tree = mounted.pop();
    act(() => {
      tree.unmount();
    });
  }
}

