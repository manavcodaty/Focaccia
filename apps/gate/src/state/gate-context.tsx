import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { x25519Keypair, toBase64Url } from '@face-pass/shared';

import { callProvisionGate, signInOrganizer, syncRevocations } from '../lib/api';
import { openGateRepository } from '../lib/expo-db';
import { expoSecureValueStore } from '../lib/expo-secure-store';
import type { GateRepository } from '../lib/gate-db';
import {
  decisionToLogEntry,
  destroyPendingVerification,
  finalizeOfflineVerification,
  prepareOfflineVerification,
  recordLivenessFailure,
} from '../lib/offline-verifier';
import {
  loadGatePrivateKey,
  saveGatePrivateKey,
} from '../lib/secure-value-store';
import type {
  GateStats,
  OrganizerAuthState,
  PendingVerification,
  ProvisioningQrPayload,
  StoredGateConfig,
  VerificationDecision,
} from '../lib/types';

interface GateContextValue {
  auth: OrganizerAuthState | null;
  completePendingVerification(
    liveEmbedding: ArrayLike<number>,
    livenessMs: number,
  ): Promise<VerificationDecision>;
  completeProvisioning(payload: ProvisioningQrPayload, deviceName: string): Promise<void>;
  dbError: string | null;
  dbReady: boolean;
  exportLogsCsv(): Promise<string>;
  failLiveness(livenessMs: number): Promise<VerificationDecision>;
  gate: StoredGateConfig | null;
  lastResult: VerificationDecision | null;
  pendingVerification: PendingVerification | null;
  processToken(token: string, scanStartedAtMs?: number): Promise<VerificationDecision | null>;
  refreshLocalState(): Promise<void>;
  refreshStats(): Promise<void>;
  resetLastResult(): void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
  stats: GateStats | null;
  syncRevocationCache(): Promise<number>;
}

const GateContext = createContext<GateContextValue | null>(null);
const REPLAY_CONFLICT_HINT = 'This pass has already been accepted on this gate.';

export function GateProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<OrganizerAuthState | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [gate, setGate] = useState<StoredGateConfig | null>(null);
  const [lastResult, setLastResult] = useState<VerificationDecision | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [repository, setRepository] = useState<GateRepository | null>(null);
  const [stats, setStats] = useState<GateStats | null>(null);

  async function reloadFromRepository(repo: GateRepository): Promise<void> {
    const [nextGate, nextStats] = await Promise.all([repo.getGateConfig(), repo.getStats()]);

    setGate(nextGate);
    setStats(nextStats);
  }

  useEffect(() => {
    let mounted = true;

    openGateRepository()
      .then(async (repo) => {
        if (!mounted) {
          return;
        }

        setRepository(repo);
        await reloadFromRepository(repo);
        setDbReady(true);
      })
      .catch((error) => {
        if (mounted) {
          setDbError(error instanceof Error ? error.message : 'Failed to open the gate database.');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<GateContextValue>(
    () => ({
      auth,
      async completePendingVerification(liveEmbedding, livenessMs) {
        if (!repository || !pendingVerification) {
          throw new Error('No pending verification is ready.');
        }

        try {
          const acceptedDecision = await finalizeOfflineVerification({
            liveEmbedding,
            livenessMs,
            pending: pendingVerification,
          });
          let decision = acceptedDecision;

          if (acceptedDecision.accepted && acceptedDecision.pass_id) {
            const wasRecorded = await repository.markPassUsed(
              acceptedDecision.event_id,
              acceptedDecision.pass_id,
              new Date().toISOString(),
            );

            if (!wasRecorded) {
              decision = {
                ...acceptedDecision,
                accepted: false,
                hint: REPLAY_CONFLICT_HINT,
                outcome: 'REJECT',
                reasonCode: 'REPLAY_USED',
              };
            }
          }

          await repository.insertLog(decisionToLogEntry(decision));
          setLastResult(decision);
          await reloadFromRepository(repository);
          return decision;
        } finally {
          destroyPendingVerification(pendingVerification);
          setPendingVerification(null);
        }
      },
      async completeProvisioning(payload, deviceName) {
        if (!repository) {
          throw new Error('Gate storage is not ready yet.');
        }

        if (!auth) {
          throw new Error('Organizer sign-in is required before provisioning.');
        }

        const keyPair = await x25519Keypair();

        try {
          const pkGateEvent = await toBase64Url(keyPair.publicKey);
          const request: {
            device_name?: string;
            event_id: string;
            pk_gate_event: string;
          } = {
            event_id: payload.event_id,
            pk_gate_event: pkGateEvent,
          };

          if (deviceName.trim()) {
            request.device_name = deviceName.trim();
          }

          const bundle = await callProvisionGate(auth, request);
          const storedGate: StoredGateConfig = {
            ...bundle,
            event_name: payload.name,
            last_revocation_sync_at: null,
            provisioned_at: new Date().toISOString(),
          };

          await saveGatePrivateKey(expoSecureValueStore, storedGate.event_id, keyPair.privateKey);
          await repository.saveGateConfig(storedGate);
          setGate(storedGate);
          await reloadFromRepository(repository);
        } finally {
          keyPair.privateKey.fill(0);
          keyPair.publicKey.fill(0);
        }
      },
      dbError,
      dbReady,
      async exportLogsCsv() {
        if (!repository) {
          throw new Error('Gate storage is not ready yet.');
        }

        return repository.exportLogsCsv();
      },
      async failLiveness(livenessMs) {
        if (!repository || !pendingVerification) {
          throw new Error('No pending verification is ready.');
        }

        try {
          const decision = recordLivenessFailure(pendingVerification, livenessMs);

          await repository.insertLog(decisionToLogEntry(decision));
          setLastResult(decision);
          await reloadFromRepository(repository);
          return decision;
        } finally {
          destroyPendingVerification(pendingVerification);
          setPendingVerification(null);
        }
      },
      gate,
      lastResult,
      pendingVerification,
      async processToken(token, scanStartedAtMs) {
        if (!repository || !gate) {
          throw new Error('Provision this gate before scanning passes.');
        }

        const gatePrivateKey = await loadGatePrivateKey(expoSecureValueStore, gate.event_id);

        if (!gatePrivateKey) {
          throw new Error('The gate private key is missing from secure storage.');
        }

        try {
          const input = {
            checkReplay: (passId: string) => repository.isPassUsed(gate.event_id, passId),
            checkRevoked: (passId: string) => repository.isPassRevoked(gate.event_id, passId),
            event: gate,
            gatePrivateKey,
            token,
          } as const;

          const result = await prepareOfflineVerification(
            scanStartedAtMs === undefined
              ? input
              : {
                  ...input,
                  scanStartedAtMs,
                },
          );

          destroyPendingVerification(pendingVerification);

          if (result.ok) {
            setPendingVerification(result.pending);
            setLastResult(null);
            return null;
          }

          await repository.insertLog(decisionToLogEntry(result.decision));
          setPendingVerification(null);
          setLastResult(result.decision);
          await reloadFromRepository(repository);
          return result.decision;
        } finally {
          gatePrivateKey.fill(0);
        }
      },
      async refreshLocalState() {
        if (!repository) {
          return;
        }

        await reloadFromRepository(repository);
      },
      async refreshStats() {
        if (!repository) {
          return;
        }

        setStats(await repository.getStats());
      },
      resetLastResult() {
        setLastResult(null);
      },
      async signIn(email, password) {
        const nextAuth = await signInOrganizer(email, password);
        setAuth(nextAuth);
      },
      signOut() {
        setAuth(null);
      },
      stats,
      async syncRevocationCache() {
        if (!repository || !gate) {
          throw new Error('Gate provisioning is required before sync.');
        }

        if (!auth) {
          throw new Error('Organizer sign-in is required before sync.');
        }

        const revocations = await syncRevocations(auth, gate.event_id);
        const syncedAtIso = new Date().toISOString();

        await repository.replaceRevocations(gate.event_id, revocations, syncedAtIso);
        await reloadFromRepository(repository);
        return revocations.length;
      },
    }),
    [auth, dbError, dbReady, gate, lastResult, pendingVerification, repository, stats],
  );

  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useGate() {
  const context = useContext(GateContext);

  if (!context) {
    throw new Error('useGate must be used within GateProvider.');
  }

  return context;
}
