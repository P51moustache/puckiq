import { useState, lazy, Suspense } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { rinkGlass } from '../../constants/theme';
import { ThemedView } from '../../components/ThemedView';
import PageHeader from '../../components/PageHeader';
import TeamHeadToHead from '../../components/TeamHeadToHead';
import { useAnalytics } from '../../hooks/useAnalytics';

const TeamsContent = lazy(() => import('./teams'));
const ModelsContent = lazy(() => import('./models'));

type Segment = 'h2h' | 'teams' | 'models';

const SEGMENTS: { key: Segment; label: string; testID: string }[] = [
  { key: 'h2h', label: 'Head-to-Head', testID: 'stats-segment-h2h' },
  { key: 'teams', label: 'All Teams', testID: 'stats-segment-teams' },
  { key: 'models', label: 'Models', testID: 'stats-segment-models' },
];

export default function ExploreScreen() {
  const [activeSegment, setActiveSegment] = useState<Segment>('h2h');
  const analytics = useAnalytics('Explore');

  const handleSegmentChange = (segment: Segment) => {
    setActiveSegment(segment);
    analytics.trackCustomEvent('explore_tab_changed', { segment });
  };

  const renderLoadingFallback = () => (
    <View style={localStyles.loadingContainer}>
      <ActivityIndicator size="large" color={rinkGlass.blueLight} />
    </View>
  );

  const renderContent = () => {
    switch (activeSegment) {
      case 'h2h':
        return <TeamHeadToHead />;
      case 'teams':
        return (
          <Suspense fallback={renderLoadingFallback()}>
            <TeamsContent embedded />
          </Suspense>
        );
      case 'models':
        return (
          <Suspense fallback={renderLoadingFallback()}>
            <ModelsContent />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <ThemedView style={localStyles.container} testID="explore-tab">
      <PageHeader title="Compare" subtitle="Pin two teams · Browse · Models" />

      <View style={localStyles.segmentControl}>
        {SEGMENTS.map((segment) => {
          const isActive = activeSegment === segment.key;
          return (
            <TouchableOpacity
              key={segment.key}
              testID={segment.testID}
              style={[
                localStyles.segmentButton,
                isActive && localStyles.segmentButtonActive,
              ]}
              onPress={() => handleSegmentChange(segment.key)}
            >
              <Text
                style={[
                  localStyles.segmentText,
                  isActive && localStyles.segmentTextActive,
                ]}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={localStyles.content}>{renderContent()}</View>
    </ThemedView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    paddingTop: Platform.OS === 'ios' ? 56 : 26,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: 'Display-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: rinkGlass.textSecondary,
    marginTop: 4,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    marginHorizontal: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: rinkGlass.blueLight,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
  },
  segmentTextActive: {
    color: rinkGlass.ice,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
});
