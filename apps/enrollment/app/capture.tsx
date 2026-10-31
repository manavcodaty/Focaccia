import { prepareCrypto } from '@face-pass/shared';
import { useRouter } from 'expo-router';
import { CameraOffIcon, CameraIcon, ShieldCheckIcon, TicketXIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { CameraGuide } from '@/components/camera-guide';
import { EmptyState } from '@/components/empty-state';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { enrollmentApi, type IssuePassResponse } from '@/lib/api';
import { issuanceMessage, phaseLabel } from '@/lib/capture-presentation';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '@/lib/embedding-model';
import { issuanceCoordinator, passVault } from '@/lib/enrollment-storage';
import { createIdempotencyKey } from '@/lib/idempotency-key';
import {
  assembleSignedPassToken,
  createPassDraftFromEmbedding,
  tokenSnippet,
  type PassProcessingPhase,
} from '@/lib/pass-flow';
import { THEME } from '@/lib/theme';
import type { PendingPassIssuance } from '@/lib/ticket-state';
import { useResponsiveLayout } from '@/lib/use-responsive-layout';
import { useAuth } from '@/state/auth-context';
import { useEnrollment } from '@/state/enrollment-context';

export default function CaptureScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
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
      .catch((error) => { if (mounted) setModelError(error instanceof Error ? error.message : 'Face model unavailable.'); });
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
    return (
      <ScreenShell>
        <EmptyState icon={TicketXIcon} title="No ticket selected">
          <Button onPress={() => router.replace('/tickets')}><Text>My tickets</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  if (!state.consentAccepted) {
    return (
      <ScreenShell>
        <EmptyState icon={ShieldCheckIcon} title="Consent required">
          <Button onPress={() => router.replace('/consent')}><Text>Review consent</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  if (!device && !hasPending) {
    return (
      <ScreenShell>
        <EmptyState icon={CameraOffIcon} title="Front camera unavailable">
          <Button onPress={() => router.push('/help')} variant="outline"><Text>Help</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  if (!hasPermission && !hasPending) {
    return (
      <ScreenShell>
        <EmptyState icon={CameraIcon} title="Camera access">
          <Button onPress={() => void requestPermission()}><Text>Allow camera</Text></Button>
          <Button onPress={() => void Linking.openSettings()} variant="outline"><Text>Open Settings</Text></Button>
        </EmptyState>
      </ScreenShell>
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

  const status = isProcessing ? phaseLabel(processingPhase) ?? 'Processing' : null;
  const canCapture = hasPending || modelReady;
  const preparing = !canCapture && !modelError;

  return (
    <ScreenShell variant="camera">
      <Text variant="h1">{hasPending ? 'Resume' : 'Capture'}</Text>

      {!hasPending ? (
        <View
          className="bg-foreground w-full self-center overflow-hidden rounded-xl"
          style={{ aspectRatio: layout.cameraAspectRatio, maxWidth: layout.cameraFrameMaxWidth }}
        >
          <Camera ref={camera} device={device!} isActive={true} photo style={StyleSheet.absoluteFill} />
          <CameraGuide ready={modelReady && !isProcessing} />
        </View>
      ) : (
        <Card>
          <CardContent className="flex-row items-center gap-3">
            <Icon as={ShieldCheckIcon} className="text-muted-foreground" size={20} />
            <Text className="flex-1">Signing request saved</Text>
          </CardContent>
        </Card>
      )}

      {modelError ? <InlineAlert message={modelError} /> : null}
      {captureError ? <InlineAlert message={captureError} /> : null}

      <Button disabled={isProcessing || !canCapture} onPress={() => void handleIssue()} size="lg">
        {isProcessing || preparing ? <ActivityIndicator color={THEME.light.primaryForeground} /> : null}
        <Text>{status ?? (hasPending ? 'Retry' : 'Capture')}</Text>
      </Button>
    </ScreenShell>
  );
}
