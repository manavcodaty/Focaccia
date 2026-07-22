import { Pressable, StyleSheet, Text } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, radii, typography } from '../theme';

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
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radii.button,
          minHeight: scaleSpacing(layout, 54, 1.08),
          paddingHorizontal: scaleSpacing(layout, 22, 1.08),
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
    borderWidth: 1,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.55 },
  ghostButton: {
    backgroundColor: palette.surface,
    borderColor: palette.borderStrong,
  },
  ghostLabel: { color: palette.ink },
  label: {
    ...typography.bodyStrong,
    letterSpacing: -0.1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    backgroundColor: palette.clay,
    borderColor: palette.clay,
  },
  primaryLabel: { color: palette.textInverse },
});
