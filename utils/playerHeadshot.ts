/**
 * Returns the NHL CDN URL for a player's headshot photo.
 * Used for hero zone star player visuals, player spotlights, etc.
 */
export function getPlayerHeadshotUrl(playerId: number): string {
  return `https://assets.nhle.com/mugs/nhl/20252026/${playerId}.png`;
}
