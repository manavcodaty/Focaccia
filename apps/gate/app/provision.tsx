import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { snippet } from '../src/lib/display';
import { parseProvisioningQrPayload } from '../src/lib/provisioning';
import { scaleFont, scaleSpacing } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import type { ProvisioningQrPayload } from '../src/lib/types';
import { useGate } from '../src/state/gate-context';
import { palette, radii, typography } from '../src/theme';

const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

function PermissionFallback({
  body,
  onPrimaryPress,
  primaryLabel,
  secondaryLabel,
  secondaryPress,
  title,
}: {
  body: string;
  onPrimaryPress(): void;
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryPress?: () => void;
  title: string;
}) {
  return (
    <ScreenShell>
      <SectionCard eyebrow="Provisioning" title={title}>
        <StatusBanner message={body} tone="warning" />
        <PrimaryButton label={primaryLabel} onPress={onPrimaryPress} />
        {secondaryLabel && secondaryPress ? (
          <PrimaryButton label={secondaryLabel} onPress={secondaryPress} tone="ghost" />
        ) : null}
      </SectionCard>
    </ScreenShell>
  );
}

function useProvisionController(isCloudE2E: boolean) {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const {
    auth,
    completeProvisioning,
    gate,
    signIn,
  } = useGate();
  const [deviceName, setDeviceName] = useState('Gate iPhone');
  const [draft, setDraft] = useState<ProvisioningQrPayload | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const emailInputRef = useRef<TextInput | null>(null);
  const passwordInputRef = useRef<TextInput | null>(null);
  const scanLockRef = useRef(false);
  useEffect(() => {
    if (!isCloudE2E) {
      return;
    }

    const encodedPayload = process.env.EXPO_PUBLIC_FOCACCIA_E2E_PROVISIONING_PAYLOAD;
    if (!encodedPayload) {
      return;
    }

    try {
      const payload = parseProvisioningQrPayload(decodeURIComponent(encodedPayload));
      scanLockRef.current = true;
      setDraft(payload);
      setFeedback('Cloud E2E provisioning payload loaded. Confirm the event and sync this device.');
    } catch (payloadError) {
      setError(payloadError instanceof Error ? payloadError.message : 'Cloud E2E provisioning payload is invalid.');
    }
  }, []);
  async function handleSignIn() {
    setError(null);
    setFeedback(null);
    setIsBusy(true);
    if (isCloudE2E) {
      emailInputRef.current?.blur();
      passwordInputRef.current?.blur();
      // Let the cloud-only static credential labels replace the native text
      // fields before the keyboard service is dismissed.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // Dismiss the focused native text field before auth changes the screen.
    // Hosted iOS 26.5 can respawn backboardd when the auth response unmounts
    // an active keyboard session during navigation.
    Keyboard.dismiss();
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      await signIn(email, password);
      setFeedback('Organizer session is active. Scan the dashboard provisioning QR now.');
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
    setFeedback(null);
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
    setFeedback(null);
  }

  return {
    auth,
    deviceName,
    draft,
    emailInputRef,
    email,
    error,
    feedback,
    gate,
    handleProvision,
    handleSignIn,
    isBusy,
    layout,
    password,
    passwordInputRef,
    resetDraft,
    router,
    scanLockRef,
    setDraft,
    setDeviceName,
    setEmail,
    setError,
    setFeedback,
    setPassword,
  };
}

type ProvisionScreenBodyProps = ReturnType<typeof useProvisionController> & {
  cameraContent: ReactNode;
  isCloudE2E: boolean;
};

function ProvisionScreenBody({
  auth,
  cameraContent,
  deviceName,
  draft,
  emailInputRef,
  email,
  error,
  feedback,
  gate,
  handleProvision,
  handleSignIn,
  isCloudE2E,
  isBusy,
  layout,
  password,
  passwordInputRef,
  resetDraft,
  router,
  setDeviceName,
  setEmail,
  setPassword,
}: ProvisionScreenBodyProps) {
  const previewStyle = {
    aspectRatio: layout.previewAspectRatio,
    borderRadius: scaleSpacing(layout, 24, 1.08),
    maxWidth: layout.previewFrameMaxWidth,
    width: '100%' as const,
  };
  const scanFrameStyle: ViewStyle = {
    borderRadius: scaleSpacing(layout, 24, 1.08),
    height: layout.isLandscape ? '58%' : '64%',
    left: layout.isLandscape ? '18%' : '15%',
    top: layout.isLandscape ? '21%' : '18%',
    width: layout.isLandscape ? '64%' : '70%',
  };

  return (
    <ScreenShell variant="wide">
      <SectionCard eyebrow="Gate setup" title="Pair this device to one event" tone="subtle">
        <StatusChip
          label={gate ? 'Action required' : 'Needs setup'}
          tone={gate ? 'warning' : 'success'}
        />
        <Text style={[styles.body, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          The gate phone generates its own X25519 keypair locally. Only the public key leaves the
          device during provisioning.
        </Text>
        {feedback ? <StatusBanner message={feedback} title="Setup update" tone="success" /> : null}
        {error ? <StatusBanner message={error} title="Setup failed" tone="danger" /> : null}
      </SectionCard>

      <SectionCard eyebrow="Organizer auth" title={auth ? auth.email : 'Sign in before sync'}>
        {auth ? (
          <StatusBanner
            message="Organizer sign-in is active. You can scan the provisioning QR and complete the one-gate sync."
            title="Organizer authenticated"
            tone="success"
          />
        ) : (
          <>
            {isCloudE2E && isBusy ? (
              <>
                <Text
                  accessibilityLabel="Organizer email"
                  style={[
                    styles.input,
                    {
                      borderRadius: radii.field,
                      fontSize: scaleFont(layout, 16),
                      minHeight: layout.isTablet ? 60 : 56,
                    },
                  ]}
                >
                  Organizer email submitted
                </Text>
                <Text
                  accessibilityLabel="Organizer password"
                  style={[
                    styles.input,
                    {
                      borderRadius: radii.field,
                      fontSize: scaleFont(layout, 16),
                      minHeight: layout.isTablet ? 60 : 56,
                    },
                  ]}
                >
                  Organizer password submitted
                </Text>
              </>
            ) : (
              <>
                <TextInput
                  ref={emailInputRef}
                  accessibilityLabel="Organizer email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setEmail}
                  placeholder="Organizer email"
                  placeholderTextColor={palette.mutedStone}
                  showSoftInputOnFocus={!isCloudE2E}
                  style={[
                    styles.input,
                    {
                      borderRadius: radii.field,
                      fontSize: scaleFont(layout, 16),
                      minHeight: layout.isTablet ? 60 : 56,
                    },
                  ]}
                  value={email}
                />
                <TextInput
                  ref={passwordInputRef}
                  accessibilityLabel="Organizer password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isCloudE2E ? 'off' : 'current-password'}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={palette.mutedStone}
                  showSoftInputOnFocus={!isCloudE2E}
                  secureTextEntry={!isCloudE2E}
                  style={[
                    styles.input,
                    {
                      borderRadius: radii.field,
                      fontSize: scaleFont(layout, 16),
                      minHeight: layout.isTablet ? 60 : 56,
                    },
                  ]}
                  value={password}
                />
              </>
            )}
            <PrimaryButton
              disabled={!email.trim() || !password || isBusy}
              label={isBusy ? 'Signing in...' : 'Sign in organizer'}
              onPress={() => {
                void handleSignIn();
              }}
            />
          </>
        )}
      </SectionCard>

      <SectionCard eyebrow="QR" title={draft ? draft.name : 'Scan the provisioning QR'}>
        <View style={[styles.preview, previewStyle]}>
          {cameraContent}
          <View style={[styles.scanFrame, scanFrameStyle]} />
        </View>
        <Text style={[styles.caption, { fontSize: scaleFont(layout, 14), lineHeight: scaleFont(layout, 20) }]}>
          {draft
            ? 'Provisioning QR captured. Review the public event material below.'
            : 'Point the rear camera at the dashboard provisioning QR.'}
        </Text>
        {draft ? (
          <>
            <MetricRow label="Event" value={draft.name} />
            <MetricRow label="Event ID" value={draft.event_id} />
            <MetricRow label="Starts" value={draft.starts_at} />
            <MetricRow label="Ends" value={draft.ends_at} />
            <MetricRow label="PK_SIGN_EVENT" value={snippet(draft.pk_sign_event)} />
            <MetricRow label="EVENT_SALT" value={snippet(draft.event_salt)} />
            {draft.pk_gate_event ? (
              <StatusBanner
                message="The dashboard QR already carries a gate public key. The server will reject duplicate provisioning if another device owns this event."
                tone="warning"
              />
            ) : null}
            {isCloudE2E ? (
              <Text
                accessibilityLabel="Gate device name"
                accessibilityValue={{ text: deviceName }}
                style={[
                  styles.input,
                  {
                    borderRadius: radii.field,
                    fontSize: scaleFont(layout, 16),
                    minHeight: layout.isTablet ? 60 : 56,
                  },
                ]}
              >
                {deviceName}
              </Text>
            ) : (
              <TextInput
                accessibilityLabel="Gate device name"
                autoCapitalize="words"
                onChangeText={setDeviceName}
                placeholder="Device name"
                placeholderTextColor={palette.mutedStone}
                showSoftInputOnFocus={!isCloudE2E}
                style={[
                  styles.input,
                  {
                    borderRadius: radii.field,
                    fontSize: scaleFont(layout, 16),
                    minHeight: layout.isTablet ? 60 : 56,
                  },
                ]}
                value={deviceName}
              />
            )}
            <PrimaryButton
              disabled={!auth || isBusy}
              label={isBusy ? 'Provisioning gate...' : 'Provision this gate'}
              onPress={() => {
                void handleProvision();
              }}
            />
            <PrimaryButton label="Scan another QR" onPress={resetDraft} tone="ghost" />
          </>
        ) : null}
      </SectionCard>
      <PrimaryButton label="Back to readiness" onPress={() => router.replace('/')} tone="ghost" />
    </ScreenShell>
  );
}

function CloudE2EProvisionScreen() {
  const controller = useProvisionController(true);

  return (
    <ProvisionScreenBody
      {...controller}
      isCloudE2E
      cameraContent={
        <View style={[styles.camera, styles.e2ePreview]}>
          <Text style={styles.e2ePreviewLabel}>Cloud E2E payload injection</Text>
        </View>
      }
    />
  );
}

function NativeProvisionScreen() {
  const controller = useProvisionController(false);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const codeScanner = useCodeScanner(
    useMemo(
      () => ({
        codeTypes: ['qr'],
        onCodeScanned: (codes: Array<{ value?: string }>) => {
          if (controller.scanLockRef.current || controller.isBusy) {
            return;
          }

          const value = codes.find((code) => code.value)?.value;

          if (!value) {
            return;
          }

          try {
            const payload = parseProvisioningQrPayload(value);

            controller.scanLockRef.current = true;
            controller.setError(null);
            controller.setFeedback('Provisioning QR decoded. Confirm the event and sync this device.');
            controller.setDraft(payload);
          } catch (scanError) {
            controller.setError(scanError instanceof Error ? scanError.message : 'Failed to parse provisioning QR.');
          }
        },
      }),
      [controller.isBusy],
    ),
  );

  if (!device) {
    return (
      <PermissionFallback
        body="A rear camera is required to read the web dashboard provisioning QR."
        onPrimaryPress={() => controller.router.replace('/')}
        primaryLabel="Back to home"
        title="Rear camera unavailable"
      />
    );
  }

  if (!hasPermission) {
    return (
      <PermissionFallback
        body="Camera access is required to provision the gate from the dashboard QR."
        onPrimaryPress={() => {
          void requestPermission();
        }}
        primaryLabel="Allow camera"
        secondaryLabel="Open settings"
        secondaryPress={() => {
          void Linking.openSettings();
        }}
        title="Camera permission required"
      />
    );
  }

  return (
    <ProvisionScreenBody
      {...controller}
      isCloudE2E={false}
      cameraContent={
        <Camera
          codeScanner={codeScanner}
          device={device}
          isActive={!controller.draft && !controller.isBusy}
          style={styles.camera}
        />
      }
    />
  );
}

export default function ProvisionScreen() {
  return process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1' ? (
    <CloudE2EProvisionScreen />
  ) : (
    <NativeProvisionScreen />
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: palette.ink,
  },
  camera: {
    flex: 1,
  },
  caption: {
    ...typography.body,
    color: palette.mutedStone,
  },
  input: {
    ...typography.body,
    backgroundColor: palette.card,
    borderColor: palette.borderStrong,
    borderWidth: 1,
    color: palette.ink,
    paddingHorizontal: 16,
  },
  e2ePreview: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    justifyContent: 'center',
    padding: 24,
  },
  e2ePreviewLabel: {
    ...typography.bodyStrong,
    color: palette.mutedStone,
    textAlign: 'center',
  },
  preview: {
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  scanFrame: {
    borderColor: palette.scanFrame,
    borderWidth: 3,
    position: 'absolute',
  },
});
