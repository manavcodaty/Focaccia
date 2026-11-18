/** Bounded simulator transport recovery. Never retain the expected input value. */
export async function settleHostedInput({ expected, label, paste, type, read, record = async () => {}, attempts = 3, readTimeoutMs = 10_000, pause = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let observedLength = 0;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const method = attempt > 1 && expected.length <= 128 && type ? 'type' : 'paste';
    let transportError = null;
    try { await (method === 'type' ? type() : paste()); }
    catch (error) { transportError = (error instanceof Error ? error.message : 'Input transport failed').replaceAll(expected, '[input value withheld]'); }
    const deadline = Date.now() + readTimeoutMs;
    do {
      let matched = false;
      try { const value = await read(); observedLength = typeof value === 'string' ? value.length : 0; matched = value === expected; } catch {}
      if (matched) {
        await record({ label, attempt, method, outcome: 'MATCH', transport_error: transportError, observed_at: new Date().toISOString() });
        return;
      }
      if (Date.now() >= deadline) break;
      await pause(150);
    } while (true);
    await record({ label, attempt, method, outcome: 'NOT_MATCHED', transport_error: transportError, observed_length: observedLength, observed_at: new Date().toISOString() });
  }
  throw new Error(`Hosted input did not settle for ${label} after ${attempts} bounded attempts (observed ${observedLength} characters; input value withheld).`);
}
