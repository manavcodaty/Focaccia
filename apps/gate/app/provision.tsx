import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import type { ProvisioningQrPayload } from '../src/lib/types';
import { useGate } from '../src/state/gate-context';
import { palette } from '../src/theme';

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

export default function ProvisionScreen() {
  const router = useRouter();
  const {
    auth,
    completeProvisioning,
    gate,
    signIn,
  } = useGate();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [deviceName, setDeviceName] = useState('Gate iPhone');
  const [draft, setDraft] = useState<ProvisioningQrPayload | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
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
            setFeedback('Provisioning QR decoded. Confirm the event and sync this device.');
            setDraft(payload);
          } catch (scanError) {
            setError(scanError instanceof Error ? scanError.message : 'Failed to parse provisioning QR.');
          }
        },
      }),
      [isBusy],
    ),
  );

  async function handleSignIn() {
    setError(null);
    setFeedback(null);
    setIsBusy(true);

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

  if (!device) {
    return (
      <PermissionFallback
        body="A rear camera is required to read the web dashboard provisioning QR."
        onPrimaryPress={() => router.replace('/')}
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
    <ScreenShell>
      <SectionCard eyebrow="Provision" title="Pair this device to one event">
        <StatusChip
          label={gate ? 'Local bundle already exists' : 'Scan dashboard QR'}
          tone={gate ? 'warning' : 'success'}
        />
        <Text style={styles.body}>
          The gate phone generates its own X25519 keypair locally. Only the public key leaves the
          device during provisioning.
        </Text>
        {feedback ? <StatusBanner message={feedback} tone="success" /> : null}
        {error ? <StatusBanner message={error} tone="danger" /> : null}
      </SectionCard>

      <SectionCard eyebrow="Organizer auth" title={auth ? auth.email : 'Sign in before sync'}>
        {auth ? (
          <StatusBanner
            message="Organizer sign-in is active. You can scan the provisioning QR and complete the one-gate sync."
            tone="success"
          />
        ) : (
          <>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setEmail}
              placeholder="Organizer email"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={palette.muted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
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
        <View style={styles.preview}>
          <Camera
            codeScanner={codeScanner}
            device={device}
            isActive={!draft && !isBusy}
            style={styles.camera}
          />
          <View style={styles.scanFrame} />
        </View>
        <Text style={styles.caption}>
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
            <TextInput
              autoCapitalize="words"
              onChangeText={setDeviceName}
              placeholder="Device name"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={deviceName}
            />
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  camera: {
    flex: 1,
  },
  caption: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  preview: {
    borderRadius: 24,
    height: 280,
    overflow: 'hidden',
    position: 'relative',
  },
  scanFrame: {
    borderColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    height: 180,
    left: '15%',
    position: 'absolute',
    top: '18%',
    width: '70%',
  },
});
