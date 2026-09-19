jest.mock('react-native', () => {
  const React = require('react');
  const node = (name: string) => {
    function MockNativeComponent({ children, ...props }: any) {
      return React.createElement(name, props, children);
    }
    return MockNativeComponent;
  };
  return {
    View: node('View'), Text: node('Text'), TextInput: node('TextInput'), TouchableOpacity: node('TouchableOpacity'),
    ScrollView: node('ScrollView'), KeyboardAvoidingView: node('KeyboardAvoidingView'), ActivityIndicator: node('ActivityIndicator'),
    Alert: { alert: jest.fn() }, StyleSheet: { create: (styles: any) => styles, flatten: (style: any) => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style ?? {} },
    Platform: { OS: 'ios' }, LayoutAnimation: { configureNext: jest.fn(), Presets: { easeInEaseOut: {} } }, UIManager: {},
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: any) => React.createElement('Ionicons', props) };
});

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ModelEditScreen, { type ModelEditScreenHandle } from '../ModelEditScreen';
import { saveModel } from '../../../services/modelStorage';
import type { PredictionModel } from '../../../types/predictions';

jest.mock('../../../services/modelStorage', () => ({
  createDefaultModel: jest.fn(() => ({
    weights: { standingsDifferential: 80, homeIceAdvantage: 8, streakImpact: 12, goalDifferentialImpact: 12, recentFormImpact: 40, backToBackPenalty: 15, restAdvantage: 8, specialTeamsImpact: 25, shotDifferentialImpact: 10 },
    playerWeights: { goalieMatchupImpact: 1, hotPlayersImpact: 1.5 },
  })),
  saveModel: jest.fn(),
}));
jest.mock('../FactorEditor', () => () => null);
jest.mock('../LivePreview', () => () => null);
jest.mock('../BacktestPanel', () => () => null);
jest.mock('../../DataSeedingModal', () => () => null);
jest.mock('../../arena/ArenaProvider', () => ({ useArena: () => ({ palette: { page: '#fff', frame: '#000', frameInk: '#fff', action: '#0ff', actionInk: '#000' } }) }));

const model: PredictionModel = {
  id: 'local-1', name: 'My model', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
  weights: { standingsDifferential: 80, homeIceAdvantage: 8, streakImpact: 12, goalDifferentialImpact: 12, recentFormImpact: 40, backToBackPenalty: 15, restAdvantage: 8, specialTeamsImpact: 25, shotDifferentialImpact: 10 },
  playerWeights: { goalieMatchupImpact: 1, hotPlayersImpact: 1.5 }, isActive: true, isDefault: false,
};

describe('ModelEditScreen behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('routes an external close request through the dirty draft guard', () => {
    const ref = React.createRef<ModelEditScreenHandle>();
    const onCancel = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ModelEditScreen ref={ref} model={model} onSave={jest.fn()} onCancel={onCancel} />);
    fireEvent.changeText(screen.getByLabelText('Model name'), 'Changed draft');

    act(() => ref.current?.requestClose());

    expect(alert).toHaveBeenCalledWith(
      'Discard changes?',
      expect.stringContaining('unsaved changes'),
      expect.arrayContaining([expect.objectContaining({ text: 'Keep editing' }), expect.objectContaining({ text: 'Discard' })]),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('allows only one save while a save is in progress', async () => {
    let resolveSave!: (value: PredictionModel) => void;
    (saveModel as jest.Mock).mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    const onSave = jest.fn();
    const screen = render(<ModelEditScreen model={model} onSave={onSave} onCancel={jest.fn()} />);
    const save = screen.getByLabelText('Save model');

    fireEvent.press(save);
    fireEvent.press(save);
    expect(saveModel).toHaveBeenCalledTimes(1);

    await act(async () => resolveSave(model));
    expect(onSave).toHaveBeenCalledWith(model);
  });

  it('keeps the edited draft after save failure so it can be retried', async () => {
    (saveModel as jest.Mock).mockRejectedValue(new Error('storage failed'));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ModelEditScreen model={model} onSave={jest.fn()} onCancel={jest.fn()} />);
    const input = screen.getByLabelText('Model name');
    fireEvent.changeText(input, 'Draft survives');
    fireEvent.press(screen.getByLabelText('Save model'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Save failed', expect.any(String), expect.any(Array)));
    expect(screen.getByDisplayValue('Draft survives')).toBeTruthy();
    expect(screen.getByLabelText('Save model')).toBeEnabled();
  });
});
