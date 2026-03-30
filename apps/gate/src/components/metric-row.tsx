import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme';

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
    color: palette.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
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
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
});
