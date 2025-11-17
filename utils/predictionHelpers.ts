/**
 * Helper function to calculate predicted winner based on standings
 * Uses team point percentage with home ice advantage factor
 */
export function getPredictedWinner(homeAbbrev: string, awayAbbrev: string, standings: any): string {
  if (!standings?.standings) {
    return homeAbbrev; // Default to home team if no standings
  }

  const home = standings.standings.find((t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === homeAbbrev);
  const away = standings.standings.find((t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === awayAbbrev);

  if (!home && !away) return homeAbbrev; // Default to home if neither found
  if (!home) return awayAbbrev; // Away wins if home not found
  if (!away) return homeAbbrev; // Home wins if away not found

  // Calculate win probabilities with home advantage
  const homeProb = (home.pointPctg || 0.5) + 0.1; // +0.1 home ice advantage
  const awayProb = away.pointPctg || 0.5;

  // Return team with higher probability (tie goes to home team)
  return homeProb >= awayProb ? homeAbbrev : awayAbbrev;
}
