/**
 * Tests for components/ModelPickerModal.tsx
 * Covers: shows all models, highlights active, calls onModelSwitch, cancel button
 */

import React from 'react';

import ModelPickerModal from '../ModelPickerModal';

// Mock react-native
jest.mock('react-native', () => ({
  Modal: ({ children, ...props }: any) =>
    React.createElement('Modal', props, children),
  View: 'View',
  Text: 'Text',
  TouchableOpacity: ({ children, ...props }: any) =>
    React.createElement('TouchableOpacity', props, children),
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'ios' },
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    text: '#ffffff',
    card: '#141c2e',
    subtle: '#1a2332',
    factbox: '#2a3a4e',
    accent: '#60a5fa',
  },
}));

// Helpers
function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

function findByTestID(node: any, testID: string): any {
  if (!node) return null;
  if (node.props?.testID === testID) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  }
  if (node.props?.children) return findByTestID(node.props.children, testID);
  return null;
}

function findAllByTestIDPrefix(node: any, prefix: string): any[] {
  const results: any[] = [];
  if (!node) return results;
  if (typeof node.props?.testID === 'string' && node.props.testID.startsWith(prefix)) {
    results.push(node);
  }
  if (Array.isArray(node)) {
    for (const child of node) results.push(...findAllByTestIDPrefix(child, prefix));
  }
  if (node.props?.children) results.push(...findAllByTestIDPrefix(node.props.children, prefix));
  return results;
}

const mockModels = [
  { id: 'classic', name: 'PuckIQ Classic', isDefault: true },
  { id: 'aggressive', name: 'Aggressive Edge', isDefault: false },
  { id: 'conservative', name: 'Conservative Pick', isDefault: false },
];

const mockOnSwitch = jest.fn();
const mockOnClose = jest.fn();

describe('ModelPickerModal', () => {
  beforeEach(() => {
    mockOnSwitch.mockClear();
    mockOnClose.mockClear();
  });

  describe('renders all models', () => {
    it('shows all model names', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const text = collectText(element);
      expect(text).toContain('PuckIQ Classic');
      expect(text).toContain('Aggressive Edge');
      expect(text).toContain('Conservative Pick');
    });

    it('renders a model option element for each model', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const options = findAllByTestIDPrefix(element, 'model-option-');
      expect(options).toHaveLength(3);
    });

    it('shows "Select Model" title', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const text = collectText(element);
      expect(text).toContain('Select Model');
    });
  });

  describe('highlights active model', () => {
    it('shows checkmark for the active model', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      // The active model option should contain the checkmark
      const activeOption = findByTestID(element, 'model-option-classic');
      const optionText = collectText(activeOption);
      expect(optionText).toContain('✓');
    });

    it('does not show checkmark for inactive models', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const inactiveOption = findByTestID(element, 'model-option-aggressive');
      const optionText = collectText(inactiveOption);
      expect(optionText).not.toContain('✓');
    });

    it('highlights a different model when activeModelId changes', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'aggressive',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const aggressiveOption = findByTestID(element, 'model-option-aggressive');
      const aggressiveText = collectText(aggressiveOption);
      expect(aggressiveText).toContain('✓');

      const classicOption = findByTestID(element, 'model-option-classic');
      const classicText = collectText(classicOption);
      expect(classicText).not.toContain('✓');
    });
  });

  describe('calls onModelSwitch on selection', () => {
    it('each model option has onPress that calls onModelSwitch with its id', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });

      // Find the aggressive model option and simulate press
      const option = findByTestID(element, 'model-option-aggressive');
      expect(option.props.onPress).toBeDefined();
      option.props.onPress();
      expect(mockOnSwitch).toHaveBeenCalledWith('aggressive');
    });

    it('calls onModelSwitch with correct id for each model', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });

      for (const model of mockModels) {
        const option = findByTestID(element, `model-option-${model.id}`);
        option.props.onPress();
      }

      expect(mockOnSwitch).toHaveBeenCalledTimes(3);
      expect(mockOnSwitch).toHaveBeenCalledWith('classic');
      expect(mockOnSwitch).toHaveBeenCalledWith('aggressive');
      expect(mockOnSwitch).toHaveBeenCalledWith('conservative');
    });
  });

  describe('cancel button', () => {
    it('renders cancel button with testID', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const cancelBtn = findByTestID(element, 'model-picker-cancel');
      expect(cancelBtn).not.toBeNull();
    });

    it('cancel button text says "Cancel"', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const cancelBtn = findByTestID(element, 'model-picker-cancel');
      const text = collectText(cancelBtn);
      expect(text).toContain('Cancel');
    });

    it('cancel button calls onClose when pressed', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const cancelBtn = findByTestID(element, 'model-picker-cancel');
      cancelBtn.props.onPress();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('default model badge', () => {
    it('shows "Default" label for default model', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const classicOption = findByTestID(element, 'model-option-classic');
      const text = collectText(classicOption);
      expect(text).toContain('Default');
    });

    it('does not show "Default" label for non-default models', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      const aggOption = findByTestID(element, 'model-option-aggressive');
      const text = collectText(aggOption);
      expect(text).not.toContain('Default');
    });
  });

  describe('empty models list', () => {
    it('renders without crashing with empty models array', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: [],
        activeModelId: undefined,
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      expect(element).not.toBeNull();
      const options = findAllByTestIDPrefix(element, 'model-option-');
      expect(options).toHaveLength(0);
    });
  });

  describe('modal visibility', () => {
    it('passes visible=true to Modal', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      expect(element.props.visible).toBe(true);
    });

    it('passes visible=false to Modal', () => {
      const element = ModelPickerModal({
        visible: false,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      expect(element.props.visible).toBe(false);
    });

    it('passes onClose to Modal onRequestClose (back button on Android)', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      expect(element.props.onRequestClose).toBe(mockOnClose);
    });
  });

  describe('overlay dismiss', () => {
    it('overlay calls onClose when pressed', () => {
      const element = ModelPickerModal({
        visible: true,
        allModels: mockModels,
        activeModelId: 'classic',
        onModelSwitch: mockOnSwitch,
        onClose: mockOnClose,
      });
      // First child of Modal is the overlay TouchableOpacity
      const overlay = element.props.children;
      expect(overlay.props.onPress).toBe(mockOnClose);
    });
  });
});
