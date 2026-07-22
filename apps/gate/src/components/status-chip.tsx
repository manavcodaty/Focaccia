import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, radii, typography } from '../theme';

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  const layout = useResponsiveLayout();
  const toneStyle = tone === 'success'
    ? styles.success
    : tone === 'warning'
      ? styles.warning
      : tone === 'danger'
        ? styles.danger
        : styles.neutral;
  const labelStyle = tone === 'success'
    ? styles.successLabel
    : tone === 'warning'
      ? styles.warningLabel
      : tone === 'danger'
        ? styles.dangerLabel
        : styles.neutralLabel;

  return (
    <View
      accessibilityLabel={`Status: ${label}`}
      accessible
      style={[
        styles.chip,
        {
          borderRadius: radii.status,
          paddingHorizontal: scaleSpacing(layout, 12, 1.06),
          paddingVertical: scaleSpacing(layout, 7, 1.06),
        },
        toneStyle,
      ]}
    >
      <Text style={[styles.label, { fontSize: scaleFont(layout, 12) }, labelStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderWidth: 1 },
  danger: { backgroundColor: palette.alertSoft, borderColor: palette.alertBorder },
  dangerLabel: { color: palette.alert },
  label: { ...typography.bodyStrong },
  neutral: { backgroundColor: palette.neutralSoft, borderColor: palette.neutralBorder },
  neutralLabel: { color: palette.ink },
  success: { backgroundColor: palette.acceptSoft, borderColor: palette.acceptBorder },
  successLabel: { color: palette.accept },
  warning: { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder },
  warningLabel: { color: palette.warning },
});
