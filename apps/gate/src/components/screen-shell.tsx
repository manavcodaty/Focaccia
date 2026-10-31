import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';

const WITH_HEADER: Edge[] = ['bottom', 'left', 'right'];
const WITHOUT_HEADER: Edge[] = ['top', 'bottom', 'left', 'right'];

/**
 * One container for every gate screen: 20px gutters, 32px between sections.
 * `scanner` widens the column for camera layouts; `accepted` / `rejected`
 * tint the whole screen so a decision reads from across the door.
 */
export function ScreenShell({
  children,
  className,
  header = true,
  scroll = true,
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  header?: boolean;
  scroll?: boolean;
  variant?: 'accepted' | 'default' | 'rejected' | 'scanner';
}) {
  const content = (
    <View
      className={cn(
        'w-full flex-1 gap-8 self-center px-5 pb-6',
        header ? 'pt-2' : 'pt-6',
        variant === 'scanner' ? 'max-w-[820px]' : 'max-w-[620px]',
        className,
      )}
    >
      {children}
    </View>
  );

  return (
    <View
      className={cn(
        'bg-background flex-1',
        variant === 'accepted' && 'bg-success/10',
        variant === 'rejected' && 'bg-destructive/10',
      )}
    >
      <SafeAreaView edges={header ? WITH_HEADER : WITHOUT_HEADER} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          {scroll ? (
            <ScrollView
              contentContainerClassName="grow"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {content}
            </ScrollView>
          ) : (
            content
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
