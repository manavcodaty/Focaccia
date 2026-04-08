import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, typography } from '../theme';

export function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const layout = useResponsiveLayout();

  return (
    <View style={[styles.row, { gap: scaleSpacing(layout, 12, 1.06) }]}>
      <Text style={[styles.label, { fontSize: scaleFont(layout, 13) }]}>{label}</Text>
      <Text style={[styles.value, { fontSize: scaleFont(layout, 15) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.title,
    color: palette.muted,
    flex: 1,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  value: {
    ...typography.title,
    color: palette.ink,
    flex: 1,
    textAlign: 'right',
  },
});
