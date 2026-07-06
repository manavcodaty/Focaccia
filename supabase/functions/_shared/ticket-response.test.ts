import { assertEquals } from 'jsr:@std/assert@1.0.14';

import { recoverTicketClaimCode, sanitizeTicketRecord } from './ticket-response.ts';

Deno.test('recoverTicketClaimCode returns decrypted claim codes', async () => {
  const claimCode = await recoverTicketClaimCode(
    { claim_code_ciphertext: 'ciphertext', id: 'ticket-ok' },
    async (ciphertext) => `decoded:${ciphertext}`,
  );

  assertEquals(claimCode, 'decoded:ciphertext');
});

Deno.test('recoverTicketClaimCode falls back to an empty code when legacy ciphertext cannot be decrypted', async () => {
  const claimCode = await recoverTicketClaimCode(
    { claim_code_ciphertext: 'legacy-ciphertext', id: 'ticket-legacy' },
    async () => {
      throw new Error('wrong secret key for the given ciphertext');
    },
  );

  assertEquals(claimCode, '');
});

Deno.test('sanitizeTicketRecord removes protected claim-code fields', () => {
  assertEquals(
    sanitizeTicketRecord({
      claim_code_ciphertext: 'ciphertext',
      claim_code_digest: 'digest',
      claim_code_hint: '1234',
      id: 'ticket-safe',
    }),
    {
      claim_code_hint: '1234',
      id: 'ticket-safe',
    },
  );
});
