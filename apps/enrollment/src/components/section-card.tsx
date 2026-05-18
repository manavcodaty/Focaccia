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
          borderRadius: 24,
          gap: scaleSpacing(layout, 14, 1.05),
          padding: scaleSpacing(layout, 20, 1.12),
        },
      ]}
    >
      {eyebrow ? (
        <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 11) }]}>
          {eyebrow}
        </Text>
      ) : null}
      {title ? (
        <Text
          style={[
            styles.title,
            {
              fontSize: scaleFont(layout, 22, 1.12),
              lineHeight: scaleFont(layout, 28, 1.12),
            },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View style={[styles.body, { gap: scaleSpacing(layout, 14, 1.05) }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {},
  card: {
    backgroundColor: palette.card,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  eyebrow: {
    ...typography.title,
    color: palette.terracotta,
    fontSize: 11,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: palette.ink,
    fontSize: 22,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
});
