import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { aggregate, validateRuns, scanSafe, CRITERIA, main } from './aggregate-sc1-sc5-evidence.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'sc1-sc5-validator-fixtures-'));
const sha = 'd'.repeat(40);
const preflight = { zero_cost_verdict: 'CONFIRMED', target: { commit_sha: sha, workflow_url: 'https://github.com/manavcodaty/Focaccia/blob/'+sha+'/.github/workflows/cloud-ios-full-flow.yml' }, dispatched_workflows: 0, blockers: [], limitations: [] };
function valid(id = 'fixture-one') {
  const artifact = id + '.json';
  writeFileSync(path.join(root, artifact), JSON.stringify({ event_id: id, gate_checkins: 1, accepted_checkins: 1, ticket_statuses: [{ status: 'checked_in', checked_in: true }], checkins:[{gate_timestamp:'2026-08-23T13:00:00Z'}], tickets:[{checked_in_at:'2026-08-23T13:00:00Z'}] }));
  const checks = Object.fromEntries(['organizer_event_created','event_listed','attendee_authenticated','ticket_claimed','owned_ticket_recovered','foreign_ticket_rejected','enrollment_pass_issued','gate_verified','dashboard_checked_in','revocation_cache_fresh','offline_acceptance','decision_backend_unreachable','offline_queue_observed','queue_persisted_after_restart','reconnect_sync','duplicate_sync_no_duplicate'].map((k) => [k,true]));
  checks.original_gate_time = '2026-08-23T13:00:00Z';
  return {
    run_id:id, workflow_run_url:'https://github.com/manavcodaty/Focaccia/actions/runs/1', commit_sha:sha, event_id:id, organizer_id_hash:id+'-organizer', attendee_id_hash:id+'-attendee', ticket_id:id+'-ticket', pass_id:id+'-pass', gate_key_fingerprint:id+'-fingerprint', gate_device_id:id+'-gate', mutable_state_isolated:true, fresh_simulator_state:true, runner_os:'macOS', started_at:'2026-08-23T12:00:00Z', fixture_sha256:'a'.repeat(64), provisioning_mode:'e2e_payload_injection', provisioning_qr_camera_scan:false, network_loss_method:'stopped_macOS_relay', checks,
    security_matrix:['genuine_unused','replay','tampered','wrong_event','expired','revoked_after_refresh','duplicate_synchronization'].map((scenario)=>({scenario,status:'PASS',expected:scenario==='genuine_unused'?'ACCEPT':'REJECT',observed:scenario==='genuine_unused'?'ACCEPT':'REJECT',input_identity:id+'-'+scenario,reason_code:'fixture-only',timestamp:'2026-08-23T13:00:00Z',backend_consequence:'fixture-only authoritative assertion'})),
    privacy_audit:{surfaces:Object.fromEntries(['schema','rows','api','logs','exports','retained_evidence'].map((s)=>[s,{verified:true,forbidden_count:0}])),encrypted_payload_classification:'event-specific gate-bound ciphertext'}, authoritative_backend:{event_id:id,accepted_checkins:1,gate_checkins:1,checked_in_tickets:1,ticket_count:1,artifact_path:artifact}, artifact_paths:[artifact], criteria:Object.fromEntries(CRITERIA.map((s)=>[s,{status:'PASS'}])),status:'PASS',failure:null
  };
}
const validate = (runs) => validateRuns(runs, preflight, root);
test('accepts a complete synthetic success fixture, not an actual observation',()=>assert.equal(validate([valid()]).length,1));
test('preserves a deliberately failed fixture and its failure reason',()=>{const r=valid();r.status='FAIL';r.failure='synthetic reconnect failure';r.criteria.SC5={status:'FAIL',reason:r.failure};assert.equal(validate([r])[0].status,'FAIL')});
test('rejects duplicate run identities',()=>assert.throws(()=>validate([valid(),valid()]),/Duplicate/));
test('rejects shared ticket even with distinct run IDs',()=>{const a=valid('a');const b=valid('b');b.ticket_id=a.ticket_id;assert.throws(()=>validate([a,b]),/ticket_id/)});
test('rejects missing commit metadata',()=>{const r=valid();delete r.commit_sha;assert.throws(()=>validate([r]),/Missing field/)});
test('rejects mismatched commit',()=>{const r=valid();r.commit_sha='e'.repeat(40);assert.throws(()=>validate([r]),/Commit mismatch/)});
test('rejects missing workflow URL',()=>{const r=valid();r.workflow_run_url='';assert.throws(()=>validate([r]),/workflow run URL/)});
test('rejects unsafe credential fields without printing their values',()=>{const r=valid();r.organizerPassword='synthetic-only-not-a-working-credential';assert.throws(()=>validate([r]),/Unsafe retained field/)});
test('rejects credential-shaped text',()=>assert.throws(()=>scanSafe('-----BEGIN '+'PRIVATE KEY-----'),/Credential-shaped/));
test('rejects missing failure records',()=>{const r=valid();r.status='FAIL';assert.throws(()=>validate([r]),/failure\/partial\/block/)});
test('rejects inconsistent authoritative manifest counts',()=>{const r=valid();r.authoritative_backend.accepted_checkins=2;assert.throws(()=>validate([r]),/backend count mismatch/)});
test('checks raw backend evidence independently of manifest assertions',()=>{const r=valid('mismatched-raw');writeFileSync(path.join(root,r.artifact_paths[0]),JSON.stringify({event_id:r.event_id,accepted_checkins:2,gate_checkins:2}));assert.throws(()=>validate([r]),/raw counts/)});
test('rejects privacy audit with missing surfaces',()=>{const r=valid();delete r.privacy_audit.surfaces.rows;assert.throws(()=>validate([r]),/Privacy audit/)});
test('rejects incomplete security matrix',()=>{const r=valid();r.security_matrix.pop();assert.throws(()=>validate([r]),/Security evidence/)});
test('rejects unproven mutable-state isolation',()=>{const r=valid();r.mutable_state_isolated=false;assert.throws(()=>validate([r]),/isolation/)});
test('rejects unavailable original gate timestamp for recovery PASS',()=>{const r=valid();r.checks.original_gate_time=0;assert.throws(()=>validate([r]),/original gate time|Recovery evidence/)});
test('rejects missing ownership rejection for full journey PASS',()=>{const r=valid();r.checks.foreign_ticket_rejected=false;assert.throws(()=>validate([r]),/ownership evidence/)});
test('empty observations yield blocked results and null rates, never invented 0% success',()=>{const p={...preflight,zero_cost_verdict:'UNVERIFIED'};const r=aggregate([],{preflight:p,baseline:{},optimization:{},security_review:{dispatch_safe:false}});assert.equal(r.status,'BLOCKED');for(const c of Object.values(r.criteria)){assert.equal(c.denominator,0);assert.equal(c.rate,null);assert.equal(c.planned_denominator,10)}});
test('FAIL and PARTIAL remain in denominators rather than selecting successes',()=>{const a=valid('denom-a');const b=valid('denom-b');b.status='FAIL';b.failure='synthetic';b.criteria.SC1={status:'FAIL',reason:'synthetic'};const r=aggregate([a,b],{preflight,baseline:{},optimization:{},security_review:{dispatch_safe:true}});assert.equal(r.criteria.SC1.numerator,1);assert.equal(r.criteria.SC1.denominator,2);assert.equal(r.criteria.SC1.status,'FAIL')});
test('complete ten synthetic observations can aggregate only with confirmed cost and safe dispatch',()=>{const runs=Array.from({length:10},(_,i)=>valid('ten-'+i));validate(runs);const r=aggregate(runs,{preflight,baseline:{},optimization:{},security_review:{dispatch_safe:true}});assert.equal(r.status,'PASS');assert.equal(r.observed_runs,10)});
test('CLI writes both blocked receipt files end to end without any real workflow execution',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'sc1-sc5-cli-fixture-'));const input=path.join(dir,'runs');
 // Test context is synthetic and excluded from the actual evidence population.
 const fs=process.getBuiltinModule('fs');fs.mkdirSync(input);
 const p={...preflight,zero_cost_verdict:'UNVERIFIED',limitations:[],blockers:[]};
 for(const [name,value] of Object.entries({preflight:p,baseline:{observations:[]},optimization:{status:'BLOCKED',baseline_wall_seconds:null,baseline_runner_seconds:null},'security-review':{dispatch_safe:false}}))writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value));
 const r=main(['--input',input,'--output',dir]);assert.equal(r.status,'BLOCKED');assert.ok(fs.existsSync(path.join(dir,'sc1-sc5-evidence-receipt.json')));assert.ok(fs.existsSync(path.join(dir,'sc1-sc5-evidence-receipt.md')));
});

test('owner dispatch override does not convert an untested privacy audit into PASS',()=>{
 const runs=Array.from({length:10},(_,i)=>valid('waived-'+i));for(const r of runs){r.status='PARTIAL';r.failure='Privacy audit not exercised';r.criteria.SC3={status:'NOT_TESTED',reason:r.failure};r.privacy_audit={status:'NOT_TESTED'};}
 validate(runs);const r=aggregate(runs,{preflight,baseline:{},optimization:{},security_review:{dispatch_safe:false,owner_dispatch_override:true}});
 assert.equal(r.status,'PARTIAL');assert.equal(r.criteria.SC3.status,'NOT_TESTED');assert.equal(r.criteria.SC3.denominator,0);assert.equal(r.criteria.SC3.rate,null);assert.equal(r.criteria.SC1.numerator,10);
});
test('an early failed observation with explicit identity gaps is preserved without fabricating a pass',()=>{
 const r=valid('early-fail');r.status='FAIL';r.failure='Simulator failed before gate setup';r.pass_id=null;r.gate_device_id=null;r.gate_key_fingerprint=null;
 r.identity_gaps=Object.fromEntries(['pass_id','gate_device_id','gate_key_fingerprint'].map(k=>[k,r.failure]));r.criteria=Object.fromEntries(CRITERIA.map(k=>[k,{status:'NOT_TESTED',reason:r.failure}]));
 assert.equal(validate([r]).length,1);r.criteria.SC1={status:'PASS'};assert.throws(()=>validate([r]),/Incomplete identities/);
});
test('authoritative original time is checked rather than merely accepting a nonempty timestamp',()=>{
 const r=valid('wrong-time');const raw=JSON.parse(readFileSync(path.join(root,r.artifact_paths[0]),'utf8'));raw.checkins[0].gate_timestamp='2026-08-23T13:01:00Z';writeFileSync(path.join(root,r.artifact_paths[0]),JSON.stringify(raw));assert.throws(()=>validate([r]),/original gate time mismatch/);
});
