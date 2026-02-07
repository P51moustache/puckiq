/**
 * Returns the NHL CDN URL for a team's SVG logo.
 * Compatible with expo-image which handles SVG rendering.
 */
export function getTeamLogoUrl(abbrev: string): string {
  return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;
}
