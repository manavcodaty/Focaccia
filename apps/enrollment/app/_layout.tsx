import { Stack } from 'expo-router';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EnrollmentProvider } from '../src/state/enrollment-context';
import { palette } from '../src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <EnrollmentProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: palette.background },
              headerShown: false,
            }}
          />
        </EnrollmentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
