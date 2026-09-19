export interface ModelsNavigator {
  canGoBack: () => boolean;
  back: () => void;
  replace: (route: '/(tabs)/stats') => void;
}

export function leaveModels(navigator: ModelsNavigator): void {
  if (navigator.canGoBack()) navigator.back();
  else navigator.replace('/(tabs)/stats');
}
