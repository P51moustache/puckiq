import { UsageJourney } from '../usageJourney';

describe('foreground usage journey', () => {
  it('measures visits and excludes time spent in the background', () => {
    let at = 0;
    const emit = jest.fn();
    const journey = new UsageJourney(() => at, emit);
    journey.setActive(true);
    journey.navigate('/tonight');
    at = 1200;
    journey.navigate('/week');
    at = 2000;
    journey.setActive(false);
    at = 62000;
    journey.setActive(true);
    at = 62500;
    journey.setActive(false);
    expect(emit.mock.calls.filter(([event]) => event === 'screen_engagement')).toEqual([
      ['screen_engagement', { screen_name: '/tonight', active_ms: 1200 }],
      ['screen_engagement', { screen_name: '/week', active_ms: 800 }],
      ['screen_engagement', { screen_name: '/week', active_ms: 500 }],
    ]);
    expect(emit.mock.calls.filter(([event]) => event === 'app_background')).toEqual([
      ['app_background', { foreground_ms: 2000 }],
      ['app_background', { foreground_ms: 500 }],
    ]);
  });

  it('does not create duplicate visits or count inactive navigation', () => {
    let at = 10;
    const emit = jest.fn();
    const journey = new UsageJourney(() => at, emit);
    journey.navigate('/roster');
    journey.navigate('/week');
    expect(emit).not.toHaveBeenCalled();
    journey.setActive(true);
    journey.setActive(true);
    journey.navigate('/week');
    at = 20;
    journey.setActive(false);
    journey.setActive(false);
    expect(emit.mock.calls.filter(([event]) => event === 'screen_view')).toEqual([['screen_view', { screen_name: '/week' }]]);
    expect(emit.mock.calls.filter(([event]) => event === 'screen_engagement')).toHaveLength(1);
  });
});
