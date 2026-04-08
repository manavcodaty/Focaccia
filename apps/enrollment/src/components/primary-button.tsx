import { Pressable, StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, typography } from '../theme';

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
  const layout = useResponsiveLayout();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: scaleSpacing(layout, 18, 1.08),
          minHeight: scaleSpacing(layout, 56, 1.08),
          paddingHorizontal: scaleSpacing(layout, 20, 1.08),
        },
        tone === 'ghost' ? styles.ghostButton : styles.primaryButton,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          { fontSize: scaleFont(layout, 16) },
          tone === 'ghost' ? styles.ghostLabel : styles.primaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
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
    ...typography.title,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButton: {
    backgroundColor: palette.accent,
  },
  primaryLabel: {
    color: palette.textInverse,
  },
});
