import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';

import type { EnrollmentBundle } from '@face-pass/shared';

import type { EnrollmentPassRecord, EnrollmentSessionState } from '../lib/types';

type EnrollmentAction =
  | {
      bundle: EnrollmentBundle;
      joinCode: string;
      type: 'set-bundle';
    }
  | {
      type: 'accept-consent';
    }
  | {
      pass: EnrollmentPassRecord;
      type: 'set-pass';
    }
  | {
      type: 'reset';
    };

interface EnrollmentContextValue {
  acceptConsent(): void;
  reset(): void;
  setBundle(joinCode: string, bundle: EnrollmentBundle): void;
  setPass(pass: EnrollmentPassRecord): void;
  state: EnrollmentSessionState;
}

const initialState: EnrollmentSessionState = {
  bundle: null,
  consentAccepted: false,
  joinCode: '',
  pass: null,
};

const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);

function reducer(
  state: EnrollmentSessionState,
  action: EnrollmentAction,
): EnrollmentSessionState {
  switch (action.type) {
    case 'set-bundle':
      return {
        bundle: action.bundle,
        consentAccepted: false,
        joinCode: action.joinCode,
        pass: null,
      };
    case 'accept-consent':
      return {
        ...state,
        consentAccepted: true,
      };
    case 'set-pass':
      return {
        ...state,
        pass: action.pass,
      };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

export function EnrollmentProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<EnrollmentContextValue>(
    () => ({
      acceptConsent() {
        dispatch({ type: 'accept-consent' });
      },
      reset() {
        dispatch({ type: 'reset' });
      },
      setBundle(joinCode: string, bundle: EnrollmentBundle) {
        dispatch({ bundle, joinCode, type: 'set-bundle' });
      },
      setPass(pass: EnrollmentPassRecord) {
        dispatch({ pass, type: 'set-pass' });
      },
      state,
    }),
    [state],
  );

  return <EnrollmentContext.Provider value={value}>{children}</EnrollmentContext.Provider>;
}

export function useEnrollment() {
  const context = useContext(EnrollmentContext);

  if (!context) {
    throw new Error('useEnrollment must be used within EnrollmentProvider.');
  }

  return context;
}
