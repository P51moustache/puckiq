/**
 * Render and query helpers over react-test-renderer for League tests. Call `unmountAll` in
 * afterEach so intervals and AppState listeners don't leak between tests.
 */

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import type React from 'react';

export type Node = any;

// Tell React this environment wraps updates in act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// React 19 logs a deprecation notice on every create(); keep test output for real problems.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
  consoleError(...args);
};

const mounted: Node[] = [];

/** Renders inside act() and returns the renderer (use `.root` to query, `.update` to re-render). */
export function render(element: React.ReactElement): Node {
  let tree: Node;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

export function unmountAll(): void {
  while (mounted.length) {
    const tree = mounted.pop();
    act(() => {
      tree.unmount();
    });
  }
}

/** Promise turns `settle` drains: enough for a call → re-read → state chain to land inside act(). */
const MICROTASK_TURNS = 10;

/** Runs a callback (a press, a timer tick) inside act() and lets the promises it starts settle. */
export async function settle(run: () => unknown = () => undefined): Promise<void> {
  await act(async () => {
    await run();
    for (let turn = 0; turn < MICROTASK_TURNS; turn += 1) await Promise.resolve();
  });
}

export function press(node: Node): void {
  act(() => {
    node.props.onPress();
  });
}

/** Presses and waits for the async handler behind it. */
export async function pressAsync(node: Node): Promise<void> {
  await act(async () => {
    await node.props.onPress();
  });
}

/** Host elements (View, Pressable, Text…) with this testID. */
export function byTestId(root: Node, id: string): Node[] {
  return root.findAll((node: Node) => node.props.testID === id && typeof node.type === 'string');
}

export function oneByTestId(root: Node, id: string): Node {
  const found = byTestId(root, id);
  if (found.length !== 1) throw new Error(`Expected one "${id}", found ${found.length}`);
  return found[0];
}

/** The plain string a node shows, nested Text included. */
export function textOf(node: Node): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || !node.children) return '';
  return node.children.map(textOf).join('');
}

/** Every Text node's string, outermost Text only, joined with " | ". */
export function allText(root: Node): string {
  const texts = root.findAll((node: Node) => node.type === 'Text');
  const nested = new Set(texts.flatMap((node: Node) => node.findAll((child: Node) => child !== node && child.type === 'Text')));
  return texts.filter((node: Node) => !nested.has(node)).map(textOf).join(' | ');
}
