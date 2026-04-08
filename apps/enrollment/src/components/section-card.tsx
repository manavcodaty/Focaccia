import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, typography } from '../theme';

export function SectionCard({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
}) {
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: scaleSpacing(layout, 28, 1.08),
          gap: scaleSpacing(layout, 14, 1.05),
          padding: scaleSpacing(layout, 20, 1.12),
        },
      ]}
    >
      {eyebrow ? <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>{eyebrow}</Text> : null}
      {title ? (
        <Text
          style={[
            styles.title,
            {
              fontSize: scaleFont(layout, 24, 1.12),
              lineHeight: scaleFont(layout, 30, 1.12),
            },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View style={[styles.body, { gap: scaleSpacing(layout, 14, 1.05) }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {},
  card: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
  },
  eyebrow: {
    ...typography.title,
    color: palette.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: palette.ink,
    fontSize: 24,
    lineHeight: 30,
  },
});
