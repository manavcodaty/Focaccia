export function sanitizeTicketRecord(
  ticket: Record<string, unknown>,
): Record<string, unknown> {
  const {
    claim_code_ciphertext: _claimCodeCiphertext,
    claim_code_digest: _claimCodeDigest,
    ...safeTicket
  } = ticket;

  return safeTicket;
}

export function sanitizeTicketResult(data: unknown): unknown {
  if (typeof data !== 'object' || data === null || !('ticket' in data)) {
    return data;
  }

  const result = data as Record<string, unknown>;
  const ticket = result.ticket;

  if (typeof ticket !== 'object' || ticket === null) {
    return data;
  }

  return {
    ...result,
    ticket: sanitizeTicketRecord(ticket as Record<string, unknown>),
  };
}
