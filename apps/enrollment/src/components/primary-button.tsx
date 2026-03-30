import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme';

export function PrimaryButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress(): void;
  tone?: 'ghost' | 'primary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'ghost' ? styles.ghostButton : styles.primaryButton,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, tone === 'ghost' ? styles.ghostLabel : styles.primaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  disabled: {
    opacity: 0.45,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: palette.line,
    borderWidth: 1,
  },
  ghostLabel: {
    color: palette.ink,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButton: {
    backgroundColor: palette.accent,
  },
  primaryLabel: {
    color: '#ffffff',
  },
});
