import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette } from '../theme';

export function ScreenShell({
  children,
  variant = 'default',
  scroll = true,
  style,
}: {
  children: ReactNode;
  variant?: 'default' | 'wide';
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const layout = useResponsiveLayout();
  const content = (
    <View
      style={[
        styles.content,
        {
          gap: layout.sectionGap,
          maxWidth: variant === 'wide' ? layout.wideContentMaxWidth : layout.contentMaxWidth,
          paddingHorizontal: layout.horizontalPadding,
          paddingVertical: layout.verticalPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        {scroll ? (
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
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

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
  },
  keyboard: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
