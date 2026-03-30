import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme';

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.chip,
        tone === 'success'
          ? styles.success
          : tone === 'warning'
            ? styles.warning
            : tone === 'danger'
              ? styles.danger
              : styles.neutral,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  danger: {
    backgroundColor: palette.alertSoft,
  },
  label: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  neutral: {
    backgroundColor: palette.panel,
  },
  success: {
    backgroundColor: palette.acceptSoft,
  },
  warning: {
    backgroundColor: palette.warningSoft,
  },
});
