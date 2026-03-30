import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '../theme';

export function ScreenShell({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const content = <View style={[styles.content, style]}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
