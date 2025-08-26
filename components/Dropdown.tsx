import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { tokens } from '@/constants/theme';

export type Option = { label: string; value: string | null };

export default function Dropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  loading,
  scheme,
}: {
  label?: string;
  placeholder: string;
  options: Option[];
  value: string | null;
  onChange: (val: string | null) => void;
  disabled?: boolean;
  loading?: boolean;
  scheme: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  const t = tokens.get(scheme);
  const textColor = t.text;
  //const border = t.modalBorder;
  const bg = t.modalBg;
  const pressedBg = t.pressed;
  const backdrop = 'rgba(0,0,0,0.4)';
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <View style={{ alignSelf: 'stretch' }}>
      {label ? (
        <Text style={{ color: scheme === 'dark' ? '#98a6bf' : '#64748b', marginBottom: 6 }}>{label}</Text>
      ) : null}
      <Pressable
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: bg,
          borderRadius: 12,
          borderWidth: 0,
          //borderColor: border,
          paddingVertical: 12,
          paddingHorizontal: 0,
          opacity: disabled || loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={scheme === 'dark' ? '#fff' : '#000'} />
        ) : (
          <Text style={{ color: textColor, alignSelf: 'center' }}>{selectedLabel || placeholder}</Text>
        )}
      </Pressable>
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: backdrop, justifyContent: 'center', paddingHorizontal: 24 }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: bg, borderRadius: 14, paddingVertical: 8, maxHeight: 420, borderWidth: 0 }}
          >
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0 }}>
              <Text style={{ color: textColor, fontWeight: '700' }}>{label || 'Select'}</Text>
            </View>
            <ScrollView>
              {options.map((opt) => (
                <Pressable
                  key={`${opt.label}-${opt.value}`}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? pressedBg : 'transparent' })}
                >
                  <Text style={{ color: textColor }}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 0 }}>
              <Text style={{ color: scheme === 'dark' ? '#e13939ff' : '#d94a4aff' }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
