import { createIssuanceCoordinator } from './issuance-coordinator';
import { createPassVault } from './pass-vault';
import { secureKeyValueStore } from './secure-storage';

export const passVault = createPassVault(secureKeyValueStore);
export const issuanceCoordinator = createIssuanceCoordinator(passVault);
