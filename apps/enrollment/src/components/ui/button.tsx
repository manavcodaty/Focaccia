import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, Pressable } from 'react-native';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-lg active:scale-[0.98]',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn('bg-primary active:bg-primary/90', Platform.select({ web: 'hover:bg-primary/90' })),
        destructive: cn(
          'bg-destructive/10 active:bg-destructive/20',
          Platform.select({ web: 'hover:bg-destructive/20' })
        ),
        outline: cn(
          'border-border bg-background active:bg-accent border',
          Platform.select({ web: 'hover:bg-accent' })
        ),
        secondary: cn('bg-secondary active:bg-secondary/80', Platform.select({ web: 'hover:bg-secondary/80' })),
        ghost: cn('active:bg-accent', Platform.select({ web: 'hover:bg-accent' })),
        link: '',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 gap-1.5 px-3',
        lg: 'h-12 px-5',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn('text-foreground text-base font-medium', Platform.select({ web: 'pointer-events-none transition-colors' })),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-destructive',
        outline: '',
        secondary: 'text-secondary-foreground',
        ghost: '',
        link: cn('text-primary', Platform.select({ web: 'underline-offset-4 hover:underline' })),
      },
      size: {
        default: '',
        sm: 'text-sm',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(props.disabled) }}
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
