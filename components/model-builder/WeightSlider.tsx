import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useArena } from '../arena/ArenaProvider';
import type { ArenaPalette } from '../../constants/arenaTheme';
import { adjustSliderValue } from './sliderAdjustment';

interface WeightSliderProps {
  factorKey: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function WeightSlider({
  factorKey,
  label,
  description,
  value,
  min,
  max,
  step,
  defaultValue,
  onChange,
  onDragStart,
  onDragEnd,
}: WeightSliderProps) {
  const { palette: p } = useArena();
  const styles = React.useMemo(() => createStyles(p), [p]);
  const [showTooltip, setShowTooltip] = useState(false);
  // Local state for smooth slider movement without parent re-renders
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local value when prop changes (but not during dragging)
  React.useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  // Determine color tint based on value vs default (use localValue for smooth UI)
  const displayValue = isDragging ? localValue : value;

  const getValueColor = useCallback(() => {
    if (Math.abs(displayValue - defaultValue) < step / 2) {
      return p.action;
    } else if (displayValue > defaultValue) {
      return '#10b981'; // Above default - green
    } else {
      return '#ef4444'; // Below default - red
    }
  }, [displayValue, defaultValue, step, p.action]);

  // Format value for display
  const formatValue = useCallback((val: number): string => {
    if (step >= 1) {
      return val.toFixed(0);
    } else if (step >= 0.1) {
      return val.toFixed(1);
    } else {
      return val.toFixed(2);
    }
  }, [step]);

  const valueColor = getValueColor();

  return (
    <View style={styles.container} testID={`weight-slider-${factorKey}`}>
      {/* Header Row: Label + Value + Info Button */}
      <View style={styles.headerRow}>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          <Pressable
            onPress={() => setShowTooltip(true)}
            style={styles.infoButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`About ${label}`}
          >
            <Ionicons name="information-circle-outline" size={20} color={p.muted} />
          </Pressable>
        </View>
        <Text style={[styles.valueDisplay, { color: valueColor }]}>
          {formatValue(displayValue)}
        </Text>
      </View>

      {/* Slider - wrapped in View to capture touch and prevent scroll interference */}
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onTouchStart={() => {
          // Disable scroll immediately when touching slider area
          onDragStart?.();
        }}
        onTouchEnd={() => {
          // Re-enable scroll after touch ends (with delay)
          setTimeout(() => {
            onDragEnd?.();
          }, 150);
        }}
      >
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={localValue}
          onValueChange={setLocalValue}
          onSlidingStart={() => {
            setIsDragging(true);
          }}
          onSlidingComplete={(val) => {
            setIsDragging(false);
            onChange(val);
          }}
          minimumTrackTintColor={valueColor}
          maximumTrackTintColor={p.edge}
          thumbTintColor={valueColor}
          accessibilityLabel={`${label} weight`}
          accessibilityHint={description}
          accessibilityValue={{ min, max, now: displayValue, text: formatValue(displayValue) }}
          accessibilityRole="adjustable"
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === 'increment' || action === 'decrement') {
              onChange(adjustSliderValue(displayValue, action, min, max, step));
            }
          }}
        />
      </View>

      {/* Default Hint */}
      <Text style={styles.defaultHint}>
        Default: {formatValue(defaultValue)}
      </Text>

      {/* Info Tooltip Modal */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <Pressable
          style={styles.tooltipOverlay}
          onPress={() => setShowTooltip(false)}
        >
          <View style={styles.tooltipContainer} accessibilityViewIsModal>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => setShowTooltip(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Close ${label} help`}
              >
                <Ionicons name="close" size={24} color={p.ink} />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipDescription}>{description}</Text>
            <View style={styles.tooltipStats}>
              <View style={styles.tooltipStatRow}>
                <Text style={styles.tooltipStatLabel}>Range:</Text>
                <Text style={styles.tooltipStatValue}>
                  {formatValue(min)} - {formatValue(max)}
                </Text>
              </View>
              <View style={styles.tooltipStatRow}>
                <Text style={styles.tooltipStatLabel}>Default:</Text>
                <Text style={styles.tooltipStatValue}>{formatValue(defaultValue)}</Text>
              </View>
              <View style={styles.tooltipStatRow}>
                <Text style={styles.tooltipStatLabel}>Current:</Text>
                <Text style={[styles.tooltipStatValue, { color: valueColor }]}>
                  {formatValue(value)}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.resetButton}
              onPress={() => {
                onChange(defaultValue);
                setShowTooltip(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Reset ${label} to default`}
            >
              <Text style={styles.resetButtonText}>Reset to Default</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (p: ArenaPalette) => StyleSheet.create({
  container: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: p.ink,
  },
  infoButton: {
    marginLeft: 6,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueDisplay: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 48,
  },
  defaultHint: {
    fontSize: 11,
    color: p.muted,
    marginTop: 2,
  },
  // Tooltip Modal Styles
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: p.paper,
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: p.edge,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.edge,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: p.ink,
    flex: 1,
  },
  tooltipDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: p.ink,
    marginBottom: 16,
  },
  tooltipStats: {
    backgroundColor: p.soft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  tooltipStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tooltipStatLabel: {
    fontSize: 13,
    color: p.muted,
  },
  tooltipStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: p.ink,
  },
  resetButton: {
    backgroundColor: p.action,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: p.actionInk,
  },
});
