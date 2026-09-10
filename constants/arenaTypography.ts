// Let display labels use native line metrics. Teko needs 1.433em; a tight
// explicit lineHeight clips cap tops on iOS. Use ArenaHeadline for compact stacks.
export const arenaType = {
  body: 'Arena-Sans',
  display: 'Arena-Display',
} as const;
