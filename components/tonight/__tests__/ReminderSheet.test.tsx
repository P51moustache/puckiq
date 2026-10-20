jest.mock('react-native', () => require('../../week/__tests__/support/mocks').reactNativeMock());
jest.mock('../../ui/TabBarBackground', () => ({ useBottomTabOverflow: () => 49 }));

import React from 'react';
import { render, unmountAll } from '../../week/__tests__/support/render';
import { allText, byTestId, flatStyle, oneByTestId } from '../../week/__tests__/support/tree';
import { ReminderSheet } from '../ReminderSheet';

const FIRST_PUCK = '2026-10-15T23:00:00Z';
const lockTime = new Date(Date.parse(FIRST_PUCK)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Two hours before FIRST_PUCK, so tonight's ping is still possible.
beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-15T21:00:00Z')); });
afterEach(() => { unmountAll(); jest.restoreAllMocks(); });

describe('ReminderSheet', () => {
  it('renders nothing until it is offered', () => {
    const root = render(<ReminderSheet visible={false} moment="before_lock" firstPuck={FIRST_PUCK} minutesBefore={60} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(byTestId(root, 'tonight-reminder-prompt')).toHaveLength(0);
  });

  it('names the lock time and the reminder lead, above the tab bar', () => {
    const root = render(<ReminderSheet visible moment="before_lock" firstPuck={FIRST_PUCK} minutesBefore={60} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(allText(root)).toContain(`Lineup locks at ${lockTime}`);
    expect(allText(root)).toContain('Want a ping an hour before puck drop, with tonight’s call?');
    expect(flatStyle(oneByTestId(root, 'tonight-reminder-prompt').props.style).paddingBottom).toBe(49 + 16);
  });

  it('falls back when the first puck drop is unknown', () => {
    const root = render(<ReminderSheet visible moment="before_lock" firstPuck={null} minutesBefore={30} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(allText(root)).toContain('Your players play tonight');
    expect(allText(root)).toContain('30 minutes before');
  });

  it('offers the next game night once tonight has locked', () => {
    const root = render(<ReminderSheet visible moment="after_lock" firstPuck={null} minutesBefore={60} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(allText(root)).toContain('Catch the next lock');
    expect(allText(root)).toContain('Want a ping an hour before puck drop on your next game night?');
  });

  it('asks from the morning recap', () => {
    const root = render(<ReminderSheet visible moment="recap" firstPuck={null} minutesBefore={30} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(allText(root)).toContain('Get the call before lock');
    expect(allText(root)).toContain('Want a ping 30 minutes before puck drop on game nights, with the call ready?');
  });

  it('renders nothing without a moment', () => {
    const root = render(<ReminderSheet visible moment={null} firstPuck={FIRST_PUCK} minutesBefore={60} onAccept={jest.fn()} onDismiss={jest.fn()} />);
    expect(byTestId(root, 'tonight-reminder-prompt')).toHaveLength(0);
  });

  it('turns reminders on, or counts a "Not now" from the button or the backdrop', () => {
    const onAccept = jest.fn(() => Promise.resolve(true));
    const onDismiss = jest.fn();
    const root = render(<ReminderSheet visible moment="before_lock" firstPuck={FIRST_PUCK} minutesBefore={60} onAccept={onAccept} onDismiss={onDismiss} />);
    oneByTestId(root, 'reminder-prompt-on').props.onPress();
    expect(onAccept).toHaveBeenCalled();
    oneByTestId(root, 'reminder-prompt-later').props.onPress();
    oneByTestId(root, 'tonight-reminder-backdrop').props.onPress();
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
