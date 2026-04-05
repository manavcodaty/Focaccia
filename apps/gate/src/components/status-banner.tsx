import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme';

export function StatusBanner({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.banner,
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
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dangerBanner: {
    backgroundColor: palette.alertSoft,
    borderColor: palette.alertBorder,
  },
  dangerText: {
    color: palette.alert,
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
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
