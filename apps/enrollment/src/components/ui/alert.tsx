import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Icon and copy side by side; the copy column shrinks so text always wraps inside the box. */
function Alert({
  className,
  variant,
  children,
  icon,
  iconClassName,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View> & {
  icon: LucideIcon;
  variant?: 'default' | 'destructive';
  iconClassName?: string;
}) {
  return (
    <TextClassContext.Provider value={cn('text-sm text-foreground', variant === 'destructive' && 'text-destructive')}>
      <View
        role="alert"
        className={cn('bg-card border-border w-full flex-row items-start gap-3 rounded-lg border px-4 py-3', className)}
        {...props}>
        <Icon
          as={icon}
          className={cn('mt-0.5 size-4', variant === 'destructive' && 'text-destructive', iconClassName)}
        />
        <View className="flex-1 gap-1">{children}</View>
      </View>
    </TextClassContext.Provider>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('font-medium leading-5', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  const textClass = React.useContext(TextClassContext);
  return (
    <Text
      className={cn(
        'text-muted-foreground leading-5',
        textClass?.includes('text-destructive') && 'text-destructive/90',
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
