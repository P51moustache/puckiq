/**
 * Always returns 'dark' since the app only supports dark mode
 */
export function useColorScheme() {
  return 'dark' as const;
}
