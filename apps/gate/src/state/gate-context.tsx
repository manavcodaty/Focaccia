import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { ed25519Keypair, x25519Keypair, toBase64Url } from '@face-pass/shared';

import {
  callProvisionGate,
  getGateRevocations,
  recordGateCheckin,
  signInOrganizer,
} from '../lib/api';
import { openGateRepository } from '../lib/expo-db';
import { expoSecureValueStore } from '../lib/expo-secure-store';
import type { GateRepository } from '../lib/gate-db';
import { cacheFreshness, createSignedCheckin, createSignedRevocationRequest } from '../lib/gate-sync';
import { flushCheckinQueue } from '../lib/gate-sync-runner';
import {
  decisionToLogEntry,
  destroyPendingVerification,
  finalizeOfflineVerification,
  prepareOfflineVerification,
  recordLivenessFailure,
} from '../lib/offline-verifier';
import {
  loadGatePrivateKey,
  loadGateSyncPrivateKey,
  saveGatePrivateKey,
  saveGateSyncPrivateKey,
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
  cancelPendingVerification(): void;
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
  retryCheckinSync(): Promise<void>;
  resetLastResult(): void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
  stats: GateStats | null;
  syncInProgress: boolean;
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
  const [syncInProgress, setSyncInProgress] = useState(false);
  const syncLock = useRef(false);

  async function reloadFromRepository(repo: GateRepository): Promise<void> {
    const [nextGate, nextStats] = await Promise.all([repo.getGateConfig(), repo.getStats()]);

    setGate(nextGate);
    setStats(nextStats);
  }

  async function refreshSignedRevocations(
    repo: GateRepository,
    currentGate: StoredGateConfig,
  ): Promise<number> {
    const privateKey = await loadGateSyncPrivateKey(expoSecureValueStore, currentGate.event_id);
    if (!privateKey) throw new Error('The gate synchronization key is missing from secure storage.');

    try {
      const request = await createSignedRevocationRequest({
        eventId: currentGate.event_id,
        gateTimestamp: new Date().toISOString(),
        keyVersion: currentGate.key_version,
        privateKey,
      });
      const snapshot = await getGateRevocations(request);
      if (snapshot.key_version !== currentGate.key_version) {
        throw new Error('The revocation snapshot key version does not match this gate.');
      }
      await repo.replaceRevocations(
        currentGate.event_id,
        snapshot.revocations,
        snapshot.server_time,
      );
      return snapshot.revocations.length;
    } finally {
      privateKey.fill(0);
    }
  }

  async function synchronizeGate(
    repo: GateRepository,
    currentGate: StoredGateConfig,
    retryBlocked = false,
  ): Promise<void> {
    if (syncLock.current) return;
    syncLock.current = true;
    setSyncInProgress(true);
    try {
      if (retryBlocked) await repo.retryPendingSyncItems(new Date().toISOString());
      await flushCheckinQueue({ repository: repo, send: recordGateCheckin });
      let refreshError: unknown;
      try {
        await refreshSignedRevocations(repo, currentGate);
      } catch (error) {
        refreshError = error;
      }
      await reloadFromRepository(repo);
      if (refreshError) throw refreshError;
    } finally {
      syncLock.current = false;
      setSyncInProgress(false);
    }
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

  useEffect(() => {
    if (!repository || !gate) return undefined;

    let active = AppState.currentState === 'active';
    let connected = false;
    const runWhenAvailable = () => {
      if (active && connected) {
        void synchronizeGate(repository, gate).catch(() => undefined);
      }
    };
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      runWhenAvailable();
    });
    const networkSubscription = NetInfo.addEventListener((state) => {
      connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      runWhenAvailable();
    });
    const interval = setInterval(runWhenAvailable, 60_000);

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      networkSubscription();
    };
  }, [repository, gate?.event_id, gate?.key_version]);

  const value = useMemo<GateContextValue>(
    () => ({
      auth,
      cancelPendingVerification() {
        destroyPendingVerification(pendingVerification);
        setPendingVerification(null);
      },
      async completePendingVerification(liveEmbedding, livenessMs) {
        if (!repository || !pendingVerification) {
          throw new Error('No pending verification is ready.');
        }

        let keepPendingForRetry = false;

        try {
          const acceptedDecision = await finalizeOfflineVerification({
            liveEmbedding,
            livenessMs,
            pending: pendingVerification,
          });
          let decision = acceptedDecision;

          if (decision.reasonCode === 'MATCH_FAIL') {
            keepPendingForRetry = true;
            setLastResult(null);
            return decision;
          }

          if (acceptedDecision.accepted && acceptedDecision.pass_id) {
            const gateTimestamp = new Date().toISOString();
            const syncPrivateKey = await loadGateSyncPrivateKey(
              expoSecureValueStore,
              acceptedDecision.event_id,
            );
            if (!syncPrivateKey) {
              throw new Error('The gate synchronization key is missing from secure storage.');
            }
            let signedCheckin;
            try {
              signedCheckin = await createSignedCheckin({
                eventId: acceptedDecision.event_id,
                gateTimestamp,
                passId: acceptedDecision.pass_id,
                privateKey: syncPrivateKey,
              });
            } finally {
              syncPrivateKey.fill(0);
            }
            const wasRecorded = await repository.recordAcceptedDecision(
              decisionToLogEntry(acceptedDecision, gateTimestamp),
              {
                ...signedCheckin,
                attempt_count: 0,
                last_error_code: null,
                next_attempt_at: gateTimestamp,
                status: 'pending',
                synced_at: null,
              },
            );

            if (!wasRecorded) {
              decision = {
                ...acceptedDecision,
                accepted: false,
                hint: REPLAY_CONFLICT_HINT,
                outcome: 'REJECT',
                reasonCode: 'REPLAY_USED',
              };
              await repository.insertLog(decisionToLogEntry(decision, gateTimestamp));
            }
          } else {
            await repository.insertLog(decisionToLogEntry(decision));
          }
          setLastResult(decision);
          await reloadFromRepository(repository);
          if (decision.accepted && gate) {
            setTimeout(() => {
              void synchronizeGate(repository, gate).catch(() => undefined);
            }, 0);
          }
          return decision;
        } finally {
          if (!keepPendingForRetry) {
            destroyPendingVerification(pendingVerification);
            setPendingVerification(null);
          }
        }
      },
      async completeProvisioning(payload, deviceName) {
        if (!repository) {
          throw new Error('Gate storage is not ready yet.');
        }

        if (!auth) {
          throw new Error('Organizer sign-in is required before provisioning.');
        }

        const [encryptionKeyPair, syncKeyPair] = await Promise.all([
          x25519Keypair(),
          ed25519Keypair(),
        ]);

        try {
          const [pkGateEvent, syncPublicKey] = await Promise.all([
            toBase64Url(encryptionKeyPair.publicKey),
            toBase64Url(syncKeyPair.publicKey),
          ]);
          const request: {
            device_name?: string;
            event_id: string;
            pk_gate_event: string;
            sync_public_key: string;
          } = {
            event_id: payload.event_id,
            pk_gate_event: pkGateEvent,
            sync_public_key: syncPublicKey,
          };

          if (deviceName.trim()) {
            request.device_name = deviceName.trim();
          }

          const bundle = await callProvisionGate(auth, request);
          const storedGate: StoredGateConfig = {
            ends_at: bundle.ends_at,
            event_id: bundle.event_id,
            event_salt: bundle.event_salt,
            event_name: payload.name,
            gate_device_id: bundle.gate_device_id,
            key_version: bundle.key_version,
            last_revocation_sync_at: null,
            pk_gate_event: bundle.pk_gate_event,
            pk_sign_event: bundle.pk_sign_event,
            policy: bundle.policy,
            provisioned_at: new Date().toISOString(),
            starts_at: bundle.starts_at,
            sync_public_key: bundle.sync_public_key,
          };

          await Promise.all([
            saveGatePrivateKey(
              expoSecureValueStore,
              storedGate.event_id,
              encryptionKeyPair.privateKey,
            ),
            saveGateSyncPrivateKey(
              expoSecureValueStore,
              storedGate.event_id,
              syncKeyPair.privateKey,
            ),
          ]);
          await repository.saveGateConfig(storedGate);
          try {
            await refreshSignedRevocations(repository, storedGate);
          } finally {
            await reloadFromRepository(repository);
          }
        } finally {
          encryptionKeyPair.privateKey.fill(0);
          encryptionKeyPair.publicKey.fill(0);
          syncKeyPair.privateKey.fill(0);
          syncKeyPair.publicKey.fill(0);
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
        if (cacheFreshness(gate.last_revocation_sync_at).state !== 'fresh') {
          throw new Error('Refresh revocations successfully before opening the scanner.');
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
      async retryCheckinSync() {
        if (!repository || !gate) throw new Error('Gate provisioning is required before sync.');
        await synchronizeGate(repository, gate, true);
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
      syncInProgress,
      async syncRevocationCache() {
        if (!repository || !gate) {
          throw new Error('Gate provisioning is required before sync.');
        }

        const count = await refreshSignedRevocations(repository, gate);
        await reloadFromRepository(repository);
        return count;
      },
    }),
    [auth, dbError, dbReady, gate, lastResult, pendingVerification, repository, stats, syncInProgress],
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
