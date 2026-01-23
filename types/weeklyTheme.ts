import { FactorType } from './factors';

export interface WeeklyTheme {
  id: string;
  name: string;
  description: string;
  factorType: FactorType;
  lessonIntro: string;
  difficulty: 'fundamental' | 'intermediate' | 'advanced';
}
