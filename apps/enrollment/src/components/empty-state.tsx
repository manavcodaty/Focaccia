import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Icon, one-line title, actions. No explanatory body — the web `Empty` pattern. */
export function EmptyState({ children, icon, title }: { children?: ReactNode; icon: LucideIcon; title: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 py-10">
      <View className="bg-muted h-10 w-10 items-center justify-center rounded-lg">
        <Icon as={icon} size={20} />
      </View>
      <Text accessibilityRole="header" className="text-lg font-medium">{title}</Text>
      {children ? <View className="w-full max-w-[320px] gap-3">{children}</View> : null}
    </View>
  );
}
