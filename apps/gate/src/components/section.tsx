import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** A titled group: small muted heading, 12px to its content (matches the web SectionHeading). */
export function Section({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <View className={cn('gap-3', className)}>
      {title ? <Text variant="h2">{title}</Text> : null}
      {children}
    </View>
  );
}
