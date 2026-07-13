import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, radii, typography } from '../theme';

export function StatusBanner({
  message,
  title,
  tone = 'neutral',
}: {
  message: string;
  title?: string;
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
  const markerStyle = tone === 'success'
    ? styles.markerSuccess
    : tone === 'warning'
      ? styles.markerWarning
      : tone === 'danger'
        ? styles.markerDanger
        : styles.markerNeutral;

  return (
    <View
      accessibilityLiveRegion={tone === 'neutral' ? 'polite' : 'assertive'}
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      accessible
      style={[
        styles.banner,
        {
          borderRadius: radii.panel,
          gap: scaleSpacing(layout, 10, 1.06),
          paddingHorizontal: scaleSpacing(layout, 16, 1.06),
          paddingVertical: scaleSpacing(layout, 14, 1.06),
        },
        toneStyle,
      ]}
    >
      <View style={[styles.marker, markerStyle]} />
      <View style={styles.copy}>
        {title ? <Text style={[styles.title, { fontSize: scaleFont(layout, 14) }]}>{title}</Text> : null}
        <Text style={[styles.message, { fontSize: scaleFont(layout, 14), lineHeight: scaleFont(layout, 20) }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'stretch',
    borderWidth: 1,
    flexDirection: 'row',
  },
  copy: { flex: 1, gap: 3 },
  danger: { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder },
  marker: { borderRadius: radii.status, borderWidth: 0, width: 3 },
  markerDanger: { backgroundColor: palette.danger },
  markerNeutral: { backgroundColor: palette.mutedStone },
  markerSuccess: { backgroundColor: palette.success },
  markerWarning: { backgroundColor: palette.warning },
  message: { ...typography.body, color: palette.ink },
  neutral: { backgroundColor: palette.neutralSoft, borderColor: palette.neutralBorder },
  success: { backgroundColor: palette.successSoft, borderColor: palette.successBorder },
  title: { ...typography.bodyStrong, color: palette.ink },
  warning: { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder },
});
