import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';

import type { EnrollmentBundleSelection } from '../lib/api';
import type {
  EnrollmentTicket,
  StoredEnrollmentPass,
} from '../lib/ticket-state';

export type IssuanceIntent = 'initial' | 'regeneration';

interface EnrollmentSessionState {
  bundle: EnrollmentBundleSelection | null;
  consentAccepted: boolean;
  intent: IssuanceIntent;
  pass: StoredEnrollmentPass | null;
  selectedTicket: EnrollmentTicket | null;
}

type EnrollmentAction =
  | { pass: StoredEnrollmentPass | null; ticket: EnrollmentTicket; type: 'select-ticket' }
  | { bundle: EnrollmentBundleSelection; intent: IssuanceIntent; type: 'set-bundle' }
  | { type: 'accept-consent' }
  | { pass: StoredEnrollmentPass; type: 'set-pass' }
  | { type: 'reset' };

interface EnrollmentContextValue {
  acceptConsent(): void;
  reset(): void;
  selectTicket(ticket: EnrollmentTicket, pass: StoredEnrollmentPass | null): void;
  setBundle(bundle: EnrollmentBundleSelection, intent: IssuanceIntent): void;
  setPass(pass: StoredEnrollmentPass): void;
  state: EnrollmentSessionState;
}

const initialState: EnrollmentSessionState = {
  bundle: null,
  consentAccepted: false,
  intent: 'initial',
  pass: null,
  selectedTicket: null,
};

const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);

function reducer(state: EnrollmentSessionState, action: EnrollmentAction): EnrollmentSessionState {
  switch (action.type) {
    case 'select-ticket':
      return {
        ...initialState,
        pass: action.pass,
        selectedTicket: action.ticket,
      };
    case 'set-bundle':
      return {
        ...state,
        bundle: action.bundle,
        consentAccepted: false,
        intent: action.intent,
      };
    case 'accept-consent':
      return { ...state, consentAccepted: true };
    case 'set-pass':
      return { ...state, pass: action.pass };
    case 'reset':
      return initialState;
  }
}

export function EnrollmentProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo<EnrollmentContextValue>(() => ({
    acceptConsent() {
      dispatch({ type: 'accept-consent' });
    },
    reset() {
      dispatch({ type: 'reset' });
    },
    selectTicket(ticket, pass) {
      dispatch({ pass, ticket, type: 'select-ticket' });
    },
    setBundle(bundle, intent) {
      dispatch({ bundle, intent, type: 'set-bundle' });
    },
    setPass(pass) {
      dispatch({ pass, type: 'set-pass' });
    },
    state,
  }), [state]);

  return <EnrollmentContext.Provider value={value}>{children}</EnrollmentContext.Provider>;
}

export function useEnrollment() {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error('useEnrollment must be used within EnrollmentProvider.');
  return context;
}
