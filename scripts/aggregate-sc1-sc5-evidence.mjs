import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CRITERIA = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'];
const STATUSES = ['PASS', 'PARTIAL', 'FAIL', 'NOT_TESTED', 'BLOCKED'];
const SCENARIOS = ['genuine_unused', 'replay', 'tampered', 'wrong_event', 'expired', 'revoked_after_refresh', 'duplicate_synchronization'];
const SURFACES = ['schema', 'rows', 'api', 'logs', 'exports', 'retained_evidence'];
const fail = (condition, message) => assert.ok(condition, message);
const load = (file) => JSON.parse(readFileSync(file, 'utf8'));
const present = (v) => v !== null && v !== undefined && v !== '' && v !== false;
const timestamp = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));

export function scanSafe(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((v, i) => scanSafe(v, `${location}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const normalized = key.replace(/[^a-z]/gi, '').toLowerCase();
      const forbidden = ['password', 'attendeepassword', 'organizerpassword', 'servicerolekey', 'privatekey', 'passtoken', 'provisioningpayload', 'rawface', 'rawfaceimage', 'reusableembedding', 'decryptedtemplate'];
      fail(!(forbidden.includes(normalized) && present(item)), `Unsafe retained field at ${location}.${key}; value withheld`);
      scanSafe(item, `${location}.${key}`);
    }
  }
  if (typeof value === 'string') {
    fail(!/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{30,})|sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value), `Credential-shaped value at ${location}; value withheld`);
    fail(!/[A-Za-z0-9_-]{180,}\.[A-Za-z0-9_-]{70,}/.test(value), `Full signed token at ${location}; value withheld`);
  }
}

export function validateRuns(runs, preflight, artifactRoot) {
  const unique = new Map();
  const fields = ['run_id', 'workflow_run_url', 'commit_sha', 'event_id', 'organizer_id_hash', 'attendee_id_hash', 'ticket_id', 'pass_id', 'gate_key_fingerprint', 'gate_device_id', 'mutable_state_isolated', 'fresh_simulator_state', 'runner_os', 'started_at', 'fixture_sha256', 'provisioning_mode', 'provisioning_qr_camera_scan', 'network_loss_method', 'checks', 'security_matrix', 'privacy_audit', 'authoritative_backend', 'artifact_paths', 'criteria', 'status', 'failure'];
  for (const run of runs) {
    scanSafe(run);
    for (const field of fields) fail(Object.hasOwn(run, field), `Missing field: ${field}`);
    fail(STATUSES.includes(run.status), 'Unknown run status');
    fail(run.commit_sha === preflight.target.commit_sha, 'Commit mismatch');
    fail(/^https:\/\/github\.com\/manavcodaty\/Focaccia\/actions\/runs\/\d+$/.test(run.workflow_run_url), 'Missing or invalid workflow run URL');
    fail(timestamp(run.started_at), 'Missing or invalid start timestamp');
    fail(/^[0-9a-f]{64}$/.test(run.fixture_sha256), 'Fixture hash missing');
    fail(typeof run.provisioning_qr_camera_scan === 'boolean' && present(run.provisioning_mode) && present(run.runner_os), 'Claim-boundary metadata missing');
    fail((run.mutable_state_isolated === true && run.fresh_simulator_state === true) || (run.status !== 'PASS' && Object.values(run.criteria).every((c) => c.status !== 'PASS') && present(run.isolation_gap)), 'Mutable state isolation unproven');
    fail(run.organizer_id_hash || (run.backend_instance_id && run.backend_isolated === true), 'Organizer or isolated backend identity missing');
    for (const field of ['run_id', 'event_id', 'attendee_id_hash', 'ticket_id', 'pass_id', 'gate_key_fingerprint', 'gate_device_id']) {
      if (!present(run[field]) && run.status !== 'PASS' && present(run.identity_gaps?.[field])) {
        fail(Object.values(run.criteria).every((c) => c.status !== 'PASS'), 'Incomplete identities cannot support a criterion PASS');
        continue;
      }
      fail(typeof run[field] === 'string' && run[field].length > 0, `Missing independence identity: ${field}`);
      const key = `${field}:${run[field]}`;
      fail(!unique.has(key), `Duplicate independence identity: ${field}`);
      unique.set(key, true);
    }
    const owner = run.backend_isolated === true ? `backend:${run.backend_instance_id}` : `organizer:${run.organizer_id_hash}`;
    fail(!unique.has(owner), 'Shared organizer/backend context'); unique.set(owner, true);
    fail(run.status === 'PASS' ? run.failure === null : present(run.failure), 'Missing failure/partial/block record');
    fail(Array.isArray(run.artifact_paths) && run.artifact_paths.length > 0, 'Raw artifacts missing');
    for (const name of run.artifact_paths) {
      fail(typeof name === 'string' && !path.isAbsolute(name), 'Artifact path must be relative');
      const resolved = realpathSync(path.resolve(artifactRoot, name));
      fail(resolved.startsWith(realpathSync(artifactRoot) + path.sep), 'Artifact escaped evidence root');
      if (/\.(?:json|md|txt|csv|log)$/.test(name)) {
        const content = readFileSync(resolved, 'utf8'); scanSafe(content);
        if (name.endsWith('.json')) scanSafe(JSON.parse(content));
      }
    }
    for (const id of CRITERIA) {
      const item = run.criteria[id]; fail(item && STATUSES.includes(item.status), `Missing criterion result: ${id}`);
      fail(item.status === 'PASS' || present(item.reason), `Missing criterion gap: ${id}`);
    }
    if (run.criteria.SC1.status === 'PASS') fail(['organizer_event_created', 'event_listed', 'attendee_authenticated', 'ticket_claimed', 'owned_ticket_recovered', 'foreign_ticket_rejected', 'enrollment_pass_issued', 'gate_verified', 'dashboard_checked_in'].every((k) => run.checks[k] === true), 'Full journey or ownership evidence incomplete');
    if (['SC1', 'SC4', 'SC5'].some((id) => run.criteria[id].status === 'PASS')) {
      const b = run.authoritative_backend;
      fail(b.event_id === run.event_id && b.accepted_checkins === 1 && b.gate_checkins === 1 && b.checked_in_tickets === 1 && b.ticket_count === 1, 'Authoritative backend count mismatch');
      fail(run.artifact_paths.includes(b.artifact_path), 'Authoritative artifact missing');
      const actual = load(path.join(artifactRoot, b.artifact_path));
      fail(actual.event_id === run.event_id && actual.accepted_checkins === 1 && actual.gate_checkins === 1, 'Authoritative raw counts mismatch');
      fail(actual.ticket_statuses?.length === 1 && actual.ticket_statuses[0].status === 'checked_in' && actual.ticket_statuses[0].checked_in === true, 'Authoritative raw ticket mismatch');
      if (run.criteria.SC5.status === 'PASS') {
        fail(actual.checkins?.length === 1 && timestamp(actual.checkins[0].gate_timestamp) && Date.parse(actual.checkins[0].gate_timestamp) === Date.parse(run.checks.original_gate_time), 'Authoritative original gate time mismatch');
        fail(actual.tickets?.length === 1 && timestamp(actual.tickets[0].checked_in_at) && Date.parse(actual.tickets[0].checked_in_at) === Date.parse(run.checks.original_gate_time), 'Ticket original gate time mismatch');
      }
    }
    if (run.criteria.SC2.status === 'PASS') fail(run.checks.revocation_cache_fresh === true && run.checks.offline_acceptance === true && run.checks.decision_backend_unreachable === true && present(run.network_loss_method), 'Offline evidence incomplete');
    if (run.criteria.SC3.status === 'PASS') {
      fail(SURFACES.every((s) => run.privacy_audit.surfaces?.[s]?.verified === true && run.privacy_audit.surfaces[s].forbidden_count === 0), 'Privacy audit missing required surfaces');
      fail(present(run.privacy_audit.encrypted_payload_classification), 'Encrypted payload classification missing');
    }
    if (run.criteria.SC4.status === 'PASS') for (const scenario of SCENARIOS) {
      const row = run.security_matrix.find((r) => r.scenario === scenario);
      fail(row?.status === 'PASS' && row.expected === row.observed && present(row.input_identity) && present(row.reason_code) && timestamp(row.timestamp) && present(row.backend_consequence), `Security evidence incomplete: ${scenario}`);
    }
    if (run.criteria.SC5.status === 'PASS') fail(['offline_queue_observed', 'queue_persisted_after_restart', 'reconnect_sync', 'dashboard_checked_in', 'duplicate_sync_no_duplicate'].every((k) => run.checks[k] === true) && timestamp(run.checks.original_gate_time), 'Recovery evidence incomplete');
    if (run.status === 'PASS') fail(CRITERIA.every((id) => run.criteria[id].status === 'PASS'), 'Run PASS conflicts with criteria');
  }
  return runs;
}

export function aggregate(runs, context) {
  const { preflight, baseline, optimization, security_review } = context;
  const criteria = Object.fromEntries(CRITERIA.map((id) => {
    const tally = Object.fromEntries(STATUSES.map((s) => [s, runs.filter((r) => r.criteria[id].status === s).length]));
    const denominator = tally.PASS + tally.FAIL + tally.PARTIAL;
    const status = preflight.zero_cost_verdict !== 'CONFIRMED' ? 'BLOCKED' : tally.FAIL ? 'FAIL' : runs.length === 10 && tally.PASS === 10 ? 'PASS' : runs.length && tally.NOT_TESTED === runs.length ? 'NOT_TESTED' : !runs.length || tally.BLOCKED === runs.length ? 'BLOCKED' : 'PARTIAL';
    return [id, { status, numerator: tally.PASS, denominator, planned_denominator: 10, tally, rate: denominator ? tally.PASS / denominator : null, workflow_run_urls: runs.map((r) => r.workflow_run_url), workflow_run_url: runs.length ? undefined : null, workflow_definition_url: preflight.target.workflow_url, raw_artifact_paths: runs.length ? [...new Set(runs.flatMap((r) => r.artifact_paths))] : ['raw/billing-usage-after-rotation.json', 'raw/actions-permissions-after-rotation.json', 'security-review.json'], gap_evidence: runs.length ? [] : ['preflight.json', 'security-review.json'], authoritative_backend_available: runs.some((r) => r.authoritative_backend?.artifact_path) }];
  }));
  const status = preflight.zero_cost_verdict !== 'CONFIRMED' || (security_review.dispatch_safe !== true && security_review.owner_dispatch_override !== true) ? 'BLOCKED' : Object.values(criteria).some((c) => c.status === 'FAIL') ? 'FAIL' : Object.values(criteria).every((c) => c.status === 'PASS') ? 'PASS' : 'PARTIAL';
  return { schema_version: 1, status, target: preflight.target, execution_mode: preflight.execution_mode ?? 'existing-workflow', zero_cost_verdict: preflight.zero_cost_verdict, cost_verification_status: preflight.cost_verification_status ?? null, target_observations: 10, observed_runs: runs.length, dispatched_workflows: preflight.dispatched_workflows, executions: preflight.executions ?? [], no_new_workflow_run_url_reason: preflight.dispatched_workflows ? null : 'No workflow was dispatched; see preflight blockers.', criteria, runs, historical_baseline: baseline, optimization, security_review, blockers: preflight.blockers, limitations: preflight.limitations };

}

export function renderMarkdown(r) {
  const rows = CRITERIA.map((id) => `| ${id} | ${r.criteria[id].status} | ${r.criteria[id].numerator}/${r.criteria[id].denominator} | ${r.criteria[id].planned_denominator} |`).join('\n');
  const sources = (r.executions ?? []).map((e) => `- [${e.role}: ${e.status}](${e.workflow_url}); commit \`${e.commit_sha}\`. ${e.reason ?? ''}`).join('\n');
  const observations = r.runs.map((o) => `- [${o.run_id}: ${o.status}](${o.workflow_run_url}); raw: ${o.artifact_paths.map((p) => `[${p}](${p})`).join(', ')}. ${o.failure ?? ''}`).join('\n');
  return `# SC1–SC5 evidence receipt\n\nOverall: **${r.status}**. ${r.status === 'PASS' ? 'All stated controlled-software thresholds met.' : 'No full completion claim.'}\n\nTarget commit: \`${r.target.commit_sha}\`. [Pinned workflow](${r.target.workflow_url}).\nExecution mode: ${r.execution_mode}; zero-cost verdict: ${r.zero_cost_verdict}; cost verification: ${r.cost_verification_status ?? 'see preflight'}.\nTarget batch observations: ${r.observed_runs}/10; workflows dispatched: ${r.dispatched_workflows}. Validation, pilot and historical runs are excluded from this target denominator. Zero tested observations means unavailable evidence, not a 0% success rate.\n\n| Criterion | Status | Passed/tested | Planned runs |\n| --- | --- | --- | --- |\n${rows}\n\n## Execution history\n\n${sources || 'No new workflow dispatched.'}\n\n## Target observations\n\n${observations || 'No target batch observations available.'}\n\n## Gaps and blockers\n\n${r.blockers.map((b) => `- ${b.code}: ${b.reason} Evidence: ${b.evidence.join(', ')}.`).join('\n') || 'No active preflight blocker; see criterion gaps and limitations.'}\n\n## Historical evidence, excluded from the new batch\n\n${(r.historical_baseline.observations ?? []).map((o) => `- [${o.conclusion}](${o.workflow_url}): ${o.summary} Raw: ${o.raw_artifact_paths.join(', ')}.`).join('\n')}\n\n## Timing and optimisation\n\nHistorical baseline: ${r.optimization.baseline_wall_seconds ?? 'unavailable'} wall seconds and ${r.optimization.baseline_runner_seconds ?? 'unavailable'} summed runner seconds. Optimised validation: ${r.optimization.optimized_workflow_url ?? 'not dispatched'}; ${r.optimization.optimized_wall_seconds ?? 'unavailable'} wall seconds, ${r.optimization.optimized_runner_seconds ?? 'unavailable'} summed runner seconds. Verdict: ${r.optimization.gain_verdict ?? r.optimization.status}. Runner elapsed time and API-reported billed time are separate measures. Current allowance is owner-attested where account APIs deny access. See [optimisation](optimization.json) for matched-workload comparison and quota limitations.\n\n## Validation and evidence boundaries\n\nSee [preflight](preflight.json), [baseline](baseline.json), [end-to-end assessment](e2e-validation.json), [data validation](data-validation.json), [security review](security-review.json), and [commands](commands.md). Raw failures and missing evidence remain retained. An owner dispatch override is not a privacy-audit PASS.\n\n${r.limitations.map((s) => `- ${s}`).join('\n')}\n`;
}

export function main(args = process.argv.slice(2)) {
  const value = (flag) => args[args.indexOf(flag) + 1];
  fail(args.includes('--input') && args.includes('--output'), 'Usage: --input RUN_DIRECTORY --output RECEIPT_DIRECTORY');
  const input = path.resolve(value('--input')); const output = path.resolve(value('--output'));
  const contextDir = args.includes('--context') ? path.resolve(value('--context')) : path.dirname(input);
  const context = Object.fromEntries(['preflight', 'baseline', 'optimization', 'security-review'].map((name) => [name.replace('-', '_'), load(path.join(contextDir, `${name}.json`))]));
  const runs = readdirSync(input).filter((f) => f.endsWith('.json')).sort().map((f) => load(path.join(input, f)));
  fail(context.preflight.zero_cost_verdict === 'CONFIRMED' || runs.length === 0, 'New observations forbidden while zero cost is unconfirmed');
  validateRuns(runs, context.preflight, contextDir);
  const receipt = aggregate(runs, context); scanSafe(receipt);
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'sc1-sc5-evidence-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  writeFileSync(path.join(output, 'sc1-sc5-evidence-receipt.md'), renderMarkdown(receipt));
  const digest = createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
  console.log(JSON.stringify({ status: receipt.status, observations: runs.length, receipt_sha256: digest }));
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
