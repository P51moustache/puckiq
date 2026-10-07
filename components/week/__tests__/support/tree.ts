/** Queries over a react-test-renderer tree rendered with the host mocks in ./reactNative. */

/** A react-test-renderer instance (the renderer ships no types). */
export type Node = any;

/** Host elements (View, Pressable, Text…) with this testID. */
export function byTestId(root: Node, id: string): Node[] {
  return root.findAll((node: Node) => node.props.testID === id && typeof node.type === 'string');
}

export function oneByTestId(root: Node, id: string): Node {
  const found = byTestId(root, id);
  if (found.length !== 1) throw new Error(`Expected one "${id}", found ${found.length}`);
  return found[0];
}

/** The plain string a Text node shows, nested Text included. */
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

/** Merge a style prop (object or nested arrays with falsy entries) into one object. */
export function flatStyle(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce((merged: Record<string, unknown>, part) => ({ ...merged, ...flatStyle(part) }), {});
  return style as Record<string, unknown>;
}
