import { Pressable, StyleSheet, Text } from 'react-native';

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
          borderRadius: 9999,
          minHeight: scaleSpacing(layout, 52, 1.08),
          paddingHorizontal: scaleSpacing(layout, 24, 1.08),
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
    opacity: 0.40,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: palette.ink,
    borderWidth: 1,
  },
  ghostLabel: {
    color: palette.ink,
  },
  label: {
    ...typography.title,
    fontSize: 16,
    letterSpacing: -0.1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  primaryButton: {
    backgroundColor: palette.ink,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  primaryLabel: {
    color: palette.textInverse,
  },
});
