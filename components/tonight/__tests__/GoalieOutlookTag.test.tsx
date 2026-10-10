jest.mock('react-native', () => require('../../week/__tests__/support/mocks').reactNativeMock());

import React from 'react';
import { goalieOutlook } from '../../../services/fantasy/goalieOutlook';
import { colors } from '../../coach/ui';
import { render, unmountAll } from '../../week/__tests__/support/render';
import { allText, byTestId, flatStyle, oneByTestId, textOf, type Node } from '../../week/__tests__/support/tree';
import { GoalieOutlookTag, outlookSentence } from '../GoalieOutlookTag';

// Gibson, Oct 10: he started the first half of Detroit's back-to-back.
const restNight = goalieOutlook({ startShare: 0.7, backToBack: 'second', firstNightStarter: 'him' });
const usualStarter = goalieOutlook({ startShare: 0.7, backToBack: null });
const firstHalf = goalieOutlook({ startShare: 0.7, backToBack: 'first' });

const labelText = (root: Node, id = 'goalie-outlook') => textOf(oneByTestId(root, `${id}-label`).findByType('Text'));
const labelColor = (root: Node) => flatStyle(oneByTestId(root, 'goalie-outlook-label').findByType('Text').props.style).color;

afterEach(unmountAll);

describe('GoalieOutlookTag', () => {
  it('shows free users the call and the reason in words', () => {
    const root = render(<GoalieOutlookTag outlook={restNight} isPro={false} />);
    expect(labelText(root)).toBe('B2B · BACKUP LIKELY');
    expect(textOf(oneByTestId(root, 'goalie-outlook-reason'))).toBe('Started last night — backups usually get the second half of a back-to-back');
    expect(byTestId(root, 'goalie-outlook-chance')).toHaveLength(0);
    expect(allText(root)).not.toMatch(/%/);
  });

  it('adds the start chance for Pro', () => {
    const root = render(<GoalieOutlookTag outlook={restNight} isPro />);
    expect(allText(oneByTestId(root, 'goalie-outlook-chance'))).toBe('18% | TO START');
  });

  it('reads the whole call to VoiceOver, as an estimate', () => {
    const tag = oneByTestId(render(<GoalieOutlookTag outlook={restNight} isPro={false} />), 'goalie-outlook');
    expect(tag.props.accessible).toBe(true);
    expect(tag.props.accessibilityLabel).toBe(
      'Estimated start: back-to-back, backup likely. Started last night — backups usually get the second half of a back-to-back.',
    );
    expect(outlookSentence(restNight, true)).toBe(`${tag.props.accessibilityLabel} About 18% chance he starts.`);
    expect(outlookSentence(usualStarter, false)).toBe('Estimated start: start likely. Usual starter.');
  });

  it('colours the call: green likely, amber toss-up, red unlikely', () => {
    expect(labelColor(render(<GoalieOutlookTag outlook={usualStarter} isPro={false} />))).toBe(colors.good);
    unmountAll();
    expect(labelColor(render(<GoalieOutlookTag outlook={firstHalf} isPro={false} />))).toBe(colors.warn);
    unmountAll();
    expect(labelColor(render(<GoalieOutlookTag outlook={restNight} isPro={false} />))).toBe(colors.bad);
  });

  it('drops the B2B prefix on an ordinary night', () => {
    expect(labelText(render(<GoalieOutlookTag outlook={usualStarter} isPro={false} />))).toBe('START LIKELY');
  });

  it('takes a testID for each row’s tag and its parts', () => {
    const root = render(<GoalieOutlookTag outlook={firstHalf} isPro testID="goalie-outlook-8476434" />);
    expect(labelText(root, 'goalie-outlook-8476434')).toBe('B2B · TOSS-UP');
    expect(byTestId(root, 'goalie-outlook-8476434-reason')).toHaveLength(1);
    expect(byTestId(root, 'goalie-outlook-8476434-chance')).toHaveLength(1);
  });

  it('never claims a confirmed starter', () => {
    for (const outlook of [restNight, usualStarter, firstHalf]) {
      const root = render(<GoalieOutlookTag outlook={outlook} isPro />);
      expect(allText(root)).not.toMatch(/confirm/i);
      expect(oneByTestId(root, 'goalie-outlook').props.accessibilityLabel).not.toMatch(/confirm/i);
      unmountAll();
    }
  });
});
