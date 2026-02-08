/** Insight type for InsightFeed analytical nuggets */
export interface Insight {
  id: string;
  text: string;
  teamAbbrev?: string;
  category: 'h2h' | 'streak' | 'rest' | 'player' | 'standings' | 'edge';
  sentiment: 'positive' | 'negative' | 'neutral';
  shareText: string;
}
