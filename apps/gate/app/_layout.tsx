import { Stack } from 'expo-router';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GateProvider } from '../src/state/gate-context';
import { palette } from '../src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <GateProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: palette.background },
              headerShown: false,
            }}
          />
        </GateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
