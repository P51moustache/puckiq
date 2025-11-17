import React from 'react';
import { render } from '@testing-library/react-native';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AnalyticsProvider>
      {ui}
    </AnalyticsProvider>
  );
}

export * from '@testing-library/react-native';
