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
import { theme } from '../../constants/theme';

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
      return theme.accent; // At default - blue
    } else if (displayValue > defaultValue) {
      return '#10b981'; // Above default - green
    } else {
      return '#ef4444'; // Below default - red
    }
  }, [displayValue, defaultValue, step]);

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
          >
            <Ionicons name="information-circle-outline" size={18} color={theme.subtext} />
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
          maximumTrackTintColor={theme.subtle}
          thumbTintColor={valueColor}
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
          <View style={styles.tooltipContainer}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => setShowTooltip(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
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
            >
              <Text style={styles.resetButtonText}>Reset to Default</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: theme.text,
  },
  infoButton: {
    marginLeft: 6,
    padding: 2,
  },
  valueDisplay: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  defaultHint: {
    fontSize: 11,
    color: theme.subtext,
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
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.accent + '44',
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  tooltipDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.text,
    marginBottom: 16,
  },
  tooltipStats: {
    backgroundColor: theme.subtle,
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
    color: theme.subtext,
  },
  tooltipStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  resetButton: {
    backgroundColor: theme.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
