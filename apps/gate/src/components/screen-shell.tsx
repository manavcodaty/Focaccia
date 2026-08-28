import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveLayout } from '../lib/use-responsive-layout';
import { palette } from '../theme';

const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

export function ScreenShell({
  children,
  variant = 'default',
  scroll = true,
  style,
}: {
  children: ReactNode;
  variant?: 'accepted' | 'default' | 'rejected' | 'scanner' | 'wide';
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const layout = useResponsiveLayout();
  const backgroundColor = variant === 'scanner'
    ? palette.surfaceInverse
    : variant === 'accepted'
      ? palette.acceptSoft
      : variant === 'rejected'
        ? palette.alertSoft
        : palette.background;
  const content = (
    <View
      style={[
        styles.content,
        {
          gap: layout.sectionGap,
          maxWidth: variant === 'wide' || variant === 'scanner' ? layout.wideContentMaxWidth : layout.contentMaxWidth,
          paddingHorizontal: layout.horizontalPadding,
          paddingVertical: layout.verticalPadding,
        },
        style,
      ]}
    >
      <StatusBar barStyle={variant === 'scanner' ? 'light-content' : 'dark-content'} />
      {children}
    </View>
  );
  const scrollContent = scroll ? (
    <ScrollView
      bounces={false}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  ) : content;

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor }]}
    >
      {isCloudE2E ? (
        <View style={styles.keyboard}>{scrollContent}</View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          {scrollContent}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
  },
  keyboard: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
