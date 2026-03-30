import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../theme';

export function SectionCard({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <View style={styles.card}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
  },
  eyebrow: {
    color: palette.highlight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
});
