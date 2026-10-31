import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

const WITH_HEADER: Edge[] = ['bottom', 'left', 'right'];
const WITHOUT_HEADER: Edge[] = ['top', 'bottom', 'left', 'right'];

/**
 * One container for every screen: 20px gutters, 32px between sections, a
 * 620pt reading column on tablets. `header` says whether the native stack
 * header (which owns the top inset) is visible.
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
  variant?: 'camera' | 'default';
}) {
  const content = (
    <View
      className={cn(
        'w-full flex-1 gap-8 self-center px-5 pb-6',
        header ? 'pt-2' : 'pt-6',
        variant === 'camera' ? 'max-w-[820px]' : 'max-w-[620px]',
        className,
      )}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={header ? WITH_HEADER : WITHOUT_HEADER} style={{ backgroundColor: THEME.light.background, flex: 1 }}>
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
  );
}
