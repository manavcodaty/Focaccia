import '../global.css';

import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from '@expo-google-fonts/geist';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NAV_THEME } from '@/lib/theme';
import { GateProvider } from '@/state/gate-context';

void SplashScreen.preventAutoHideAsync();

const colors = NAV_THEME.light.colors;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <GateProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitle: '',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* Leaving these must run their own cleanup, so no header or swipe-back. */}
            <Stack.Screen name="face-match" options={{ gestureEnabled: false, headerShown: false }} />
            <Stack.Screen name="result" options={{ gestureEnabled: false, headerShown: false }} />
          </Stack>
          <PortalHost />
        </GateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
