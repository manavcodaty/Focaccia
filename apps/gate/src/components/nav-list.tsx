import { ChevronRightIcon, type LucideIcon } from 'lucide-react-native';
import { Fragment } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

export type NavItem = { disabled?: boolean; icon: LucideIcon; label: string; onPress(): void };

/** Grouped navigation rows (icon, label, chevron) — a settings-style list. */
export function NavList({ items }: { items: NavItem[] }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? <Separator /> : null}
          <Button
            accessibilityLabel={item.label}
            className="h-12 justify-start gap-3 rounded-none px-4"
            disabled={Boolean(item.disabled)}
            onPress={item.onPress}
            variant="ghost"
          >
            <Icon as={item.icon} className="text-muted-foreground" size={18} />
            <Text className="flex-1 font-normal">{item.label}</Text>
            <Icon as={ChevronRightIcon} className="text-muted-foreground" size={16} />
          </Button>
        </Fragment>
      ))}
    </Card>
  );
}
