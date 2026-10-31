import { useRouter } from 'expo-router';
import { CameraIcon, CameraOffIcon, CircleCheckIcon } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import { DetailList } from '@/components/detail-list';
import { EmptyState } from '@/components/empty-state';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { formatTimestamp } from '@/lib/display';
import { parseProvisioningQrPayload } from '@/lib/provisioning';
import { THEME } from '@/lib/theme';
import type { ProvisioningQrPayload } from '@/lib/types';
import { useResponsiveLayout } from '@/lib/use-responsive-layout';
import { useGate } from '@/state/gate-context';

export default function ProvisionScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { auth, completeProvisioning, signIn, signOut } = useGate();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [deviceName, setDeviceName] = useState('Gate iPhone');
  const [draft, setDraft] = useState<ProvisioningQrPayload | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const scanLockRef = useRef(false);
  const codeScanner = useCodeScanner(
    useMemo(
      () => ({
        codeTypes: ['qr'],
        onCodeScanned: (codes: Array<{ value?: string }>) => {
          if (scanLockRef.current || isBusy) {
            return;
          }

          const value = codes.find((code) => code.value)?.value;

          if (!value) {
            return;
          }

          try {
            const payload = parseProvisioningQrPayload(value);

            scanLockRef.current = true;
            setError(null);
            setDraft(payload);
          } catch (scanError) {
            setError(scanError instanceof Error ? scanError.message : 'Not a gate QR.');
          }
        },
      }),
      [isBusy],
    ),
  );

  async function handleSignIn() {
    setError(null);
    setIsBusy(true);

    try {
      await signIn(email, password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign-in failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleProvision() {
    if (!draft) {
      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      await completeProvisioning(draft, deviceName);
      router.replace('/scan');
    } catch (provisionError) {
      setError(provisionError instanceof Error ? provisionError.message : 'Provisioning failed.');
    } finally {
      setIsBusy(false);
    }
  }

  function resetDraft() {
    scanLockRef.current = false;
    setDraft(null);
  }

  if (!device) {
    return (
      <ScreenShell>
        <EmptyState icon={CameraOffIcon} title="Rear camera unavailable" />
      </ScreenShell>
    );
  }

  if (!hasPermission) {
    return (
      <ScreenShell>
        <EmptyState icon={CameraIcon} title="Camera access">
          <Button onPress={() => void requestPermission()}><Text>Allow camera</Text></Button>
          <Button onPress={() => void Linking.openSettings()} variant="outline"><Text>Open Settings</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const spinner = <ActivityIndicator color={THEME.light.primaryForeground} />;

  return (
    <ScreenShell variant="scanner">
      <Text variant="h1">Provisioning</Text>

      {error ? <InlineAlert message={error} /> : null}

      <Section title="Organizer">
        {auth ? (
          <Card className="py-2">
            <CardContent className="flex-row items-center gap-3 pr-2">
              <Icon as={CircleCheckIcon} className="text-success" size={18} />
              <Text className="flex-1 text-sm" numberOfLines={1}>{auth.email}</Text>
              <Button disabled={isBusy} onPress={signOut} size="sm" variant="ghost">
                <Text>Sign out</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <View className="gap-4">
            <View className="gap-2">
              <Label nativeID="organizer-email">Email</Label>
              <Input
                accessibilityLabel="Organizer email"
                aria-labelledby="organizer-email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                textContentType="emailAddress"
                value={email}
              />
            </View>
            <View className="gap-2">
              <Label nativeID="organizer-password">Password</Label>
              <Input
                accessibilityLabel="Organizer password"
                aria-labelledby="organizer-password"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                onSubmitEditing={() => void handleSignIn()}
                secureTextEntry
                textContentType="password"
                value={password}
              />
            </View>
            <Button disabled={!email.trim() || !password || isBusy} onPress={() => void handleSignIn()}>
              {isBusy ? spinner : null}
              <Text>Sign in</Text>
            </Button>
          </View>
        )}
      </Section>

      <Section title="Gate QR">
        {draft ? (
          <DetailList
            items={[
              { label: 'Event', value: draft.name },
              { label: 'Starts', value: formatTimestamp(draft.starts_at) },
              { label: 'Ends', value: formatTimestamp(draft.ends_at) },
            ]}
          />
        ) : (
          <View
            className="bg-foreground w-full self-center overflow-hidden rounded-xl"
            style={{ aspectRatio: layout.previewAspectRatio, maxWidth: layout.previewFrameMaxWidth }}
          >
            <Camera
              codeScanner={codeScanner}
              device={device}
              isActive={!draft && !isBusy}
              style={StyleSheet.absoluteFill}
            />
            <View className="absolute inset-[15%] rounded-xl border-2 border-white/80" pointerEvents="none" />
          </View>
        )}
      </Section>

      {draft ? (
        <Section title="Device">
          {draft.pk_gate_event ? <InlineAlert message="Already bound to another device." /> : null}
          <View className="gap-2">
            <Label nativeID="device-name">Name</Label>
            <Input
              accessibilityLabel="Gate device name"
              aria-labelledby="device-name"
              autoCapitalize="words"
              onChangeText={setDeviceName}
              value={deviceName}
            />
          </View>
          <Button disabled={!auth || isBusy} onPress={() => void handleProvision()}>
            {isBusy ? spinner : null}
            <Text>Provision</Text>
          </Button>
          <Button disabled={isBusy} onPress={resetDraft} variant="outline">
            <Text>Scan again</Text>
          </Button>
        </Section>
      ) : null}
    </ScreenShell>
  );
}
