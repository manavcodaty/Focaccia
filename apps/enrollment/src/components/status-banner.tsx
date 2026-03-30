import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme';

export function StatusBanner({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.banner,
        tone === 'success'
          ? styles.successBanner
          : tone === 'warning'
            ? styles.warningBanner
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
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  neutralBanner: {
    backgroundColor: '#f8f3ea',
    borderColor: palette.line,
  },
  neutralText: {
    color: palette.ink,
  },
  successBanner: {
    backgroundColor: palette.successSoft,
    borderColor: '#a5dbbf',
  },
  successText: {
    color: palette.success,
  },
  warningBanner: {
    backgroundColor: palette.warningSoft,
    borderColor: '#e4c78e',
  },
  warningText: {
    color: palette.warning,
  },
});
