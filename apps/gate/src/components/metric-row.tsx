import { StyleSheet, Text, View } from 'react-native';

import { palette, typography } from '../theme';

export function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.title,
    color: palette.muted,
    flex: 1,
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  value: {
    ...typography.title,
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
});
