import { Fragment } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type Detail = { label: string; tone?: 'default' | 'destructive' | 'success' | 'warning'; value: string };

/** Label / value rows in one card, separated by hairlines. */
export function DetailList({ items }: { items: Detail[] }) {
  return (
    <Card className="gap-0 py-0">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? <Separator /> : null}
          <View accessibilityLabel={`${item.label}: ${item.value}`} accessible className="flex-row items-center justify-between gap-4 px-4 py-3">
            <Text className="text-muted-foreground text-sm">{item.label}</Text>
            <Text
              className={cn(
                'shrink text-right text-sm',
                item.tone === 'success' && 'text-success',
                item.tone === 'warning' && 'text-warning',
                item.tone === 'destructive' && 'text-destructive',
              )}
              numberOfLines={1}
            >
              {item.value}
            </Text>
          </View>
        </Fragment>
      ))}
    </Card>
  );
}
