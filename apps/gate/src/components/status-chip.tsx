import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, typography } from '../theme';

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.chip,
        {
          borderRadius: 9999,
          paddingHorizontal: scaleSpacing(layout, 14, 1.06),
          paddingVertical: scaleSpacing(layout, 8, 1.06),
        },
        tone === 'success'
          ? styles.success
          : tone === 'warning'
            ? styles.warning
            : tone === 'danger'
              ? styles.danger
              : styles.neutral,
      ]}
    >
      <Text style={[styles.label, { fontSize: scaleFont(layout, 12) }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
  },
  danger: {
    backgroundColor: palette.alertSoft,
  },
  label: {
    ...typography.title,
    color: palette.ink,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  neutral: {
    backgroundColor: palette.fog,
  },
  success: {
    backgroundColor: palette.acceptSoft,
  },
  warning: {
    backgroundColor: palette.warningSoft,
  },
});
