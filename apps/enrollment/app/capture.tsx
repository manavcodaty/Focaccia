import { prepareCrypto } from '@face-pass/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { CameraGuide } from '../src/components/camera-guide';
import { PrimaryButton } from '../src/components/primary-button';
import { StatusBanner } from '../src/components/status-banner';
import { enrollmentApi, FunctionApiError, type IssuePassResponse } from '../src/lib/api';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '../src/lib/embedding-model';
import { issuanceCoordinator, passVault } from '../src/lib/enrollment-storage';
import { createIdempotencyKey } from '../src/lib/idempotency-key';
import {
  assembleSignedPassToken,
  createPassDraftFromEmbedding,
  tokenSnippet,
  type PassProcessingPhase,
} from '../src/lib/pass-flow';
import type { PendingPassIssuance } from '../src/lib/ticket-state';
import { useAuth } from '../src/state/auth-context';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, radii, typography } from '../src/theme';

function phaseLabel(phase: PassProcessingPhase | null, hasPending: boolean): string {
  if (hasPending && phase === null) return 'A previous signing request is ready to resume.';
  switch (phase) {
    case 'generating-template': return 'Generating event-scoped template';
    case 'encrypting-pass': return 'Encrypting to the gate public key';
    case 'requesting-signature': return 'Verifying ownership and requesting signature';
    case 'finalizing-pass': return 'Saving the signed pass securely';
    default: return 'Align your face inside the guide, then capture.';
  }
}

function issuanceMessage(error: unknown): string {
  if (error instanceof FunctionApiError) {
    if (error.code === 'pass_generation_limit') return 'This ticket has already used all three pass generations.';
    if (error.code === 'ticket_state_conflict') return 'This ticket changed state. Refresh My tickets before trying again.';
    if (error.code === 'ticket_not_found') return 'This account no longer owns an enrollable ticket.';
    if (error.code === 'gate_not_provisioned') return 'The organizer has not provisioned the event gate yet.';
  }
  return error instanceof Error ? error.message : 'Pass issuance failed.';
}

export default function CaptureScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const captureInFlight = useRef(false);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { user } = useAuth();
  const { setPass, state } = useEnrollment();
  const ticket = state.selectedTicket;
  const selection = state.bundle;
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<PassProcessingPhase | null>(null);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadFaceEmbeddingModel(), prepareCrypto()])
      .then(() => { if (mounted) setModelReady(true); })
      .catch((error) => { if (mounted) setModelError(error instanceof Error ? error.message : 'Failed to load the face model.'); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!user || !ticket) return;
    let mounted = true;
    void passVault.loadPending(user.id, ticket.id).then((pending) => {
      if (mounted) setHasPending(Boolean(pending));
    });
    return () => { mounted = false; };
  }, [ticket, user]);

  if (!user || !ticket || !selection) {
    return <Fallback title="Enrollment session missing" body="Select an owned ticket from My tickets before opening capture." label="Back to My tickets" onPress={() => router.replace('/tickets')} />;
  }

  if (!state.consentAccepted) {
    return <Fallback title="Consent required" body="Review and accept the privacy details before camera capture starts." label="Review consent" onPress={() => router.replace('/consent')} />;
  }

  if (!device && !hasPending) {
    return <Fallback title="Front camera unavailable" body="A front camera could not be found on this device." label="Open help" onPress={() => router.push('/help')} />;
  }

  if (!hasPermission && !hasPending) {
    return (
      <Fallback
        title="Camera permission required"
        body="Camera access is used only for on-device capture and pass creation."
        label="Allow camera"
        onPress={() => void requestPermission()}
        secondaryLabel="Open settings"
        secondaryPress={() => void Linking.openSettings()}
      />
    );
  }

  async function handleIssue() {
    if (
      captureInFlight.current ||
      isProcessing ||
      !user ||
      !ticket ||
      !selection ||
      (!hasPending && (!camera.current || !modelReady))
    ) {
      return;
    }

    captureInFlight.current = true;
    setCaptureError(null);
    setIsProcessing(true);
    setProcessingPhase(null);

    try {
      const pass = await issuanceCoordinator.issue<IssuePassResponse>({
        createPending: async () => {
          if (!camera.current) throw new Error('The camera is not ready.');
          const photo = await camera.current.takePhoto({ enableShutterSound: false });
          const embedding = await extractFaceEmbeddingFromPhoto({
            photoHeight: photo.height,
            photoPath: photo.path,
            photoWidth: photo.width,
          });
          try {
            const draft = await createPassDraftFromEmbedding({
              bundle: selection.event,
              embedding,
              onPhaseChange: setProcessingPhase,
            });
            try {
              return {
                createdAtIso: new Date().toISOString(),
                idempotencyKey: await createIdempotencyKey(),
                payload: draft.payload,
                ticketId: ticket.id,
                userId: user.id,
              } satisfies PendingPassIssuance;
            } finally {
              draft.template.fill(0);
            }
          } finally {
            embedding.fill(0);
          }
        },
        finalize: async (pending, result) => {
          setProcessingPhase('finalizing-pass');
          const signed = await assembleSignedPassToken({ issueResult: result, payload: pending.payload });
          return {
            createdAtIso: new Date().toISOString(),
            event: ticket.event,
            generation: result.generation,
            passId: pending.payload.pass_id,
            ...(signed.queueCode ? { queueCode: signed.queueCode } : {}),
            ticketId: ticket.id,
            ticketTypeName: ticket.ticket_type.name,
            token: signed.token,
            tokenSnippet: tokenSnippet(signed.token),
            userId: user.id,
          };
        },
        submit: async (pending) => {
          setProcessingPhase('requesting-signature');
          return enrollmentApi.issuePass({
            idempotencyKey: pending.idempotencyKey,
            payload: pending.payload,
            ticketId: pending.ticketId,
          });
        },
        ticketId: ticket.id,
        userId: user.id,
      });
      setPass(pass);
      setHasPending(false);
      router.replace('/pass');
    } catch (error) {
      setHasPending(Boolean(await passVault.loadPending(user.id, ticket.id)));
      setCaptureError(issuanceMessage(error));
    } finally {
      captureInFlight.current = false;
      setIsProcessing(false);
      setProcessingPhase(null);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{state.intent === 'regeneration' ? 'Regeneration' : 'Enrollment'}</Text>
            <Text style={styles.title}>Create the pass on this phone.</Text>
            <Text style={styles.subtitle}>{ticket.event.name}</Text>
          </View>

          {!hasPending ? (
            <View style={styles.cameraStage}>
              <Camera ref={camera} device={device!} isActive={true} photo style={StyleSheet.absoluteFill} />
              <View style={styles.cameraTint} />
              <CameraGuide ready={modelReady && !isProcessing} />
            </View>
          ) : (
            <View style={styles.resumeCard}>
              <Text style={styles.resumeTitle}>Resume secure issuance</Text>
              <Text style={styles.resumeBody}>The encrypted payload and idempotency key are protected on this device. Retrying sends the exact same request and does not consume another generation.</Text>
            </View>
          )}

          <View style={styles.controls}>
            {modelError ? <StatusBanner message={modelError} title="Model unavailable" tone="warning" /> : null}
            {!modelReady && !hasPending ? <StatusBanner message="Loading the face model and cryptographic runtime…" title="Preparing on-device processing" tone="neutral" /> : null}
            {captureError ? <StatusBanner message={captureError} title="Pass not issued" tone="warning" /> : null}
            <View style={styles.progressCard}>
              {isProcessing ? <ActivityIndicator color={palette.ink} /> : null}
              <Text style={styles.progressTitle}>{phaseLabel(processingPhase, hasPending)}</Text>
              <Text style={styles.progressBody}>Keep this screen open until the signed pass is saved.</Text>
            </View>
            <PrimaryButton
              disabled={isProcessing || (!hasPending && !modelReady)}
              label={isProcessing ? 'Creating secure pass...' : hasPending ? 'Retry secure issuance' : 'Capture and issue pass'}
              onPress={() => void handleIssue()}
            />
            <PrimaryButton label="Back" onPress={() => router.back()} tone="ghost" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Fallback({ body, label, onPress, secondaryLabel, secondaryPress, title }: {
  body: string;
  label: string;
  onPress(): void;
  secondaryLabel?: string;
  secondaryPress?: () => void;
  title: string;
}) {
  return (
    <View style={styles.fallback}>
      <View style={styles.fallbackCard}>
        <Text style={styles.fallbackTitle}>{title}</Text>
        <Text style={styles.fallbackBody}>{body}</Text>
        <PrimaryButton label={label} onPress={onPress} />
        {secondaryLabel && secondaryPress ? <PrimaryButton label={secondaryLabel} onPress={secondaryPress} tone="ghost" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraStage: { alignSelf: 'center', aspectRatio: 0.82, backgroundColor: palette.surfaceInverse, borderRadius: radii.credential, maxHeight: 500, overflow: 'hidden', width: '100%' },
  cameraTint: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.overlay },
  content: { alignSelf: 'center', flexGrow: 1, gap: 18, maxWidth: 520, padding: 16, width: '100%' },
  controls: { backgroundColor: palette.canvas, borderRadius: radii.panel, gap: 12, padding: 18 },
  eyebrow: { ...typography.bodyStrong, color: palette.warmMist, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  fallback: { alignItems: 'center', backgroundColor: palette.canvas, flex: 1, justifyContent: 'center', padding: 20 },
  fallbackBody: { ...typography.body, color: palette.mutedStone, fontSize: 15, lineHeight: 22 },
  fallbackCard: { backgroundColor: palette.fog, borderRadius: radii.panel, gap: 14, maxWidth: 480, padding: 22, width: '100%' },
  fallbackTitle: { ...typography.title, color: palette.ink, fontSize: 24 },
  header: { backgroundColor: palette.surfaceInverseSoft, borderRadius: radii.panel, gap: 8, padding: 20 },
  progressBody: { ...typography.body, color: palette.mutedStone, fontSize: 13, lineHeight: 19 },
  progressCard: { backgroundColor: palette.fog, borderRadius: radii.field, gap: 8, padding: 14 },
  progressTitle: { ...typography.bodyStrong, color: palette.ink, fontSize: 15 },
  resumeBody: { ...typography.body, color: palette.ink, fontSize: 15, lineHeight: 23 },
  resumeCard: { backgroundColor: palette.warmMist, borderRadius: radii.credential, gap: 10, padding: 24 },
  resumeTitle: { ...typography.title, color: palette.ink, fontSize: 24 },
  safeArea: { flex: 1 },
  screen: { backgroundColor: palette.surfaceInverse, flex: 1 },
  subtitle: { ...typography.body, color: palette.textInverseMuted, fontSize: 15 },
  title: { ...typography.title, color: palette.textInverse, fontSize: 28, lineHeight: 34 },
});
