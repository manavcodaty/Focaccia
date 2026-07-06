import 'react-native-get-random-values';

import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EnrollmentProvider } from '../src/state/enrollment-context';
import { AuthProvider } from '../src/state/auth-context';
import { palette } from '../src/theme';

void SplashScreen.preventAutoHideAsync();

import { LinearGradient } from 'expo-linear-gradient';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
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
    <GestureHandlerRootView style={styles.root}>
      <LinearGradient
        colors={['#ffffff', '#fbe1d1', '#f7f7f8']}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.root}
      >
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" />
          <AuthProvider>
            <EnrollmentProvider>
              <Stack
                screenOptions={{
                  animation: 'slide_from_right',
                  contentStyle: { backgroundColor: 'transparent' },
                  headerBackTitle: 'Back',
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: palette.canvas },
                  headerTintColor: palette.ink,
                  headerTitleStyle: { fontFamily: 'IBMPlexSans_600SemiBold' },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="tickets" options={{ headerShown: false }} />
                <Stack.Screen name="ticket" options={{ title: 'Ticket' }} />
                <Stack.Screen name="approved" options={{ title: 'Approved' }} />
                <Stack.Screen name="consent" options={{ title: 'Privacy and consent' }} />
                <Stack.Screen name="capture" options={{ headerShown: false }} />
                <Stack.Screen name="pass" options={{ title: 'Event pass' }} />
                <Stack.Screen name="help" options={{ title: 'Help' }} />
              </Stack>
            </EnrollmentProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
