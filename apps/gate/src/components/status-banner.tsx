import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, radii, typography } from '../theme';

const toneStyles = {
  danger: { backgroundColor: palette.alertSoft, borderColor: palette.alertBorder },
  neutral: { backgroundColor: palette.neutralSoft, borderColor: palette.neutralBorder },
  success: { backgroundColor: palette.acceptSoft, borderColor: palette.acceptBorder },
  warning: { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder },
} as const;

export function StatusBanner({
  message,
  title,
  tone = 'neutral',
}: {
  message: string;
  title?: string;
  tone?: keyof typeof toneStyles;
}) {
  const layout = useResponsiveLayout();

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
        toneStyles[tone],
      ]}
    >
      <View style={[styles.marker, tone === 'danger' ? styles.markerDanger : tone === 'success' ? styles.markerSuccess : tone === 'warning' ? styles.markerWarning : styles.markerNeutral]} />
      <View style={styles.copy}>
        {title ? <Text style={[styles.title, { fontSize: scaleFont(layout, 14) }]}>{title}</Text> : null}
        <Text style={[styles.message, { fontSize: scaleFont(layout, 14), lineHeight: scaleFont(layout, 20) }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: 'stretch', borderWidth: 1, flexDirection: 'row' },
  copy: { flex: 1, gap: 3 },
  marker: { borderRadius: radii.status, width: 3 },
  markerDanger: { backgroundColor: palette.alert },
  markerNeutral: { backgroundColor: palette.mutedStone },
  markerSuccess: { backgroundColor: palette.accept },
  markerWarning: { backgroundColor: palette.warning },
  message: { ...typography.body, color: palette.ink },
  title: { ...typography.bodyStrong, color: palette.ink },
});
