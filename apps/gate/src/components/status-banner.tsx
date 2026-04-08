import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, typography } from '../theme';

export function StatusBanner({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.banner,
        {
          borderRadius: scaleSpacing(layout, 18, 1.05),
          paddingHorizontal: scaleSpacing(layout, 14, 1.06),
          paddingVertical: scaleSpacing(layout, 12, 1.06),
        },
        tone === 'success'
          ? styles.successBanner
          : tone === 'warning'
            ? styles.warningBanner
            : tone === 'danger'
              ? styles.dangerBanner
              : styles.neutralBanner,
      ]}
    >
      <Text
        style={[
          styles.message,
          {
            fontSize: scaleFont(layout, 14),
            lineHeight: scaleFont(layout, 20),
          },
          tone === 'success'
            ? styles.successText
            : tone === 'warning'
              ? styles.warningText
              : tone === 'danger'
                ? styles.dangerText
                : styles.neutralText,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1 },
  dangerBanner: {
    backgroundColor: palette.alertSoft,
    borderColor: palette.alertBorder,
  },
  dangerText: {
    color: palette.alert,
  },
  message: {
    ...typography.title,
  },
  neutralBanner: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
  },
  neutralText: {
    color: palette.ink,
  },
  successBanner: {
    backgroundColor: palette.acceptSoft,
    borderColor: palette.acceptBorder,
  },
  successText: {
    color: palette.accept,
  },
  warningBanner: {
    backgroundColor: palette.warningSoft,
    borderColor: palette.warningBorder,
  },
  warningText: {
    color: palette.warning,
  },
});
