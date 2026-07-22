import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { scaleFont, scaleSpacing } from '../lib/responsive-metrics';
import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette, radii, typography } from '../theme';

export function SectionCard({
  children,
  eyebrow,
  title,
  tone = 'default',
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  tone?: 'default' | 'subtle' | 'warning';
}) {
  const layout = useResponsiveLayout();

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.card,
        {
          borderRadius: radii.panel,
          gap: scaleSpacing(layout, 14, 1.05),
          padding: scaleSpacing(layout, 20, 1.12),
        },
        tone === 'subtle' ? styles.subtle : null,
        tone === 'warning' ? styles.warning : null,
      ]}
    >
      {eyebrow ? <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 11) }]}>{eyebrow}</Text> : null}
      {title ? <Text style={[styles.title, { fontSize: scaleFont(layout, 21, 1.12), lineHeight: scaleFont(layout, 27, 1.12) }]}>{title}</Text> : null}
      <View style={{ gap: scaleSpacing(layout, 14, 1.05) }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 },
  eyebrow: { ...typography.bodyStrong, color: palette.clay, letterSpacing: 1.6, textTransform: 'uppercase' },
  subtle: { backgroundColor: palette.surfaceSubtle, borderColor: palette.surfaceSubtle },
  title: { ...typography.title, color: palette.ink, letterSpacing: -0.35 },
  warning: { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder },
});
