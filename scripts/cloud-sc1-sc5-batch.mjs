import assert from 'node:assert/strict';
import { createHash, createPublicKey, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createSecurityControls, eventSigningKey } from './lib/cloud-security-controls.mjs';
import { createBatchCoordinator } from './lib/cloud-batch-coordinator.mjs';

export function observationCount(raw) {
  assert.ok(raw === '1' || raw === '2' || raw === '10', 'Observation count must be 1 (smoke), 2 (reuse validation) or 10 (batch).');
  return Number(raw);
}
const required = (key) => { assert.ok(process.env[key], `${key} is required`); return process.env[key]; };
const save = (file, data) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data, null, 2)+'\n', { mode: 0o600 }); };
const load = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (text) => createHash('sha256').update(text).digest('hex');
export const runCloudCommand = (exe, args, options = {}) => new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{stdio:'inherit',...options});child.once('error',reject);
  child.once('exit',(code,signal)=>{if(code===0)resolve();else{const error=new Error(`Cloud command failed: ${exe} ${args.join(' ')} (${signal??code})`);error.status=code??1;reject(error);}});
});
const command = runCloudCommand;

async function backend(count) {
  const api = required('FOCACCIA_CLOUD_API_URL');
  const anon = required('FOCACCIA_CLOUD_ANON_KEY');
  const temp = required('RUNNER_TEMP');
  const instance = required('GITHUB_RUN_ID');
  const service = readFileSync(path.join(temp, 'focaccia-service-role-key'), 'utf8').trim();
  const root = path.join(temp, 'focaccia-cloud-batch', 'observations');
  const prepare = async (i) => {
    await command('supabase',['db','reset','--workdir','.focaccia/runtime','--local','--no-seed']);
    let ready=false;
    for(let n=0;n<90;n++){
      try{const r=await fetch(api+'/functions/v1/get-public-events',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break;}}catch{}
      await delay(1000);
    }
    assert.ok(ready,'Functions did not recover after isolated database reset');
    const [emptyEvents,emptyUsers]=await Promise.all([fetch(api+'/rest/v1/events?select=event_id',{headers:{apikey:service,authorization:'Bearer '+service}}),fetch(api+'/auth/v1/admin/users?per_page=1',{headers:{apikey:service,authorization:'Bearer '+service}})]);
    assert.ok(emptyEvents.ok&&emptyUsers.ok,'Fresh database state could not be queried');
    assert.equal((await emptyEvents.json()).length,0,'Previous observation events survived reset');
    assert.equal((await emptyUsers.json()).users.length,0,'Previous observation credentials survived reset');
    const index=String(i).padStart(2,'0');const email=`batch-${instance}-${index}@example.com`;
    const password='Batch-'+randomBytes(24).toString('base64url')+'!';
    if(process.env.GITHUB_ACTIONS==='true') console.log(`::add-mask::${password}`);
    const signup=await fetch(api+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email,password})});
    assert.ok(signup.ok,`Batch organizer signup failed: HTTP ${signup.status}`);
    const auth=await signup.json();assert.ok(auth.access_token,'Batch organizer session is missing');
    const provision=await fetch(api+'/functions/v1/ensure-organizer',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+auth.access_token,'content-type':'application/json'},body:'{}'});
    assert.ok(provision.ok,`Batch organizer authority failed: HTTP ${provision.status}`);
    const dir=path.join(root,index);const contextFile=path.join(dir,'context.json');
    await command(process.execPath,['scripts/cloud-browser-e2e.mjs'],{env:{...process.env,FOCACCIA_CLOUD_BATCH:'1',FOCACCIA_CLOUD_ORGANIZER_EMAIL:email,FOCACCIA_CLOUD_ORGANIZER_PASSWORD:password,FOCACCIA_CLOUD_CONTEXT_PATH:contextFile,FOCACCIA_CLOUD_ARTIFACT_DIR:path.join(dir,'browser')}});
    const context=load(contextFile);
    context.browserChecks=load(path.join(dir,'browser','report.json'));
    const response=await fetch(api+'/rest/v1/event_tickets?event_id=eq.'+encodeURIComponent(context.eventId)+'&select=id,attendee_user_id',{headers:{apikey:service,authorization:'Bearer '+service}});
    assert.ok(response.ok,`Batch identity query failed: HTTP ${response.status}`);
    const tickets=await response.json();assert.equal(tickets.length,1,'Expected one ticket per isolated event');
    const foreignSignup=await fetch(api+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email:`foreign-${context.runId}@example.com`,password:'Foreign-'+randomBytes(24).toString('base64url')+'!'})});
    assert.ok(foreignSignup.ok,'Foreign-owner test setup failed');const foreign=await foreignSignup.json();assert.ok(foreign.access_token,'Foreign-owner session is missing');
    const forbidden=await fetch(api+'/functions/v1/get-enrollment-bundle',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+foreign.access_token,'content-type':'application/json'},body:JSON.stringify({ticket_id:tickets[0].id})});
    const forbiddenBody=await forbidden.json();assert.equal(forbidden.status,404);assert.equal(forbiddenBody.error?.code,'ticket_not_found');
    save(path.join(dir,'ownership-check.json'),{expected:'REJECT',observed:'REJECT',http_status:forbidden.status,reason_code:forbiddenBody.error.code,timestamp:new Date().toISOString(),ticket_id:tickets[0].id});
    context.foreignTicketRejected=true;
    Object.assign(context,{ticketId:tickets[0].id,organizerIdHash:hash(auth.user.id),attendeeIdHash:hash(tickets[0].attendee_user_id),backendInstanceId:instance+':'+index,backendIsolationMethod:'full_runner_local_database_reset'});
    const secretsResponse=await fetch(api+'/rest/v1/edge_event_secrets?event_id=eq.'+encodeURIComponent(context.eventId)+'&select=sk_sign_event_ciphertext',{headers:{apikey:service,authorization:'Bearer '+service}});
    assert.ok(secretsResponse.ok,'Isolated signing-key setup query failed');const secretRows=await secretsResponse.json();assert.equal(secretRows.length,1);
    const envText=readFileSync('supabase/functions/.env','utf8');const keyLine=envText.split(/\r?\n/).find(line=>line.startsWith('FACE_PASS_SECRET_WRAPPING_KEY_B64URL='));assert.ok(keyLine,'Isolated wrapping key is missing');
    const wrapping=Buffer.from(keyLine.slice(keyLine.indexOf('=')+1).replace(/^["']|["']$/g,''),'base64url');
    const requireShared=createRequire(new URL('../packages/shared/package.json',import.meta.url));const sodium=requireShared('libsodium-wrappers');await sodium.ready;
    const [nonce,ciphertext]=secretRows[0].sk_sign_event_ciphertext.split('.').map(v=>Buffer.from(v,'base64url'));
    let signingSecret;
    try {
      signingSecret=sodium.crypto_secretbox_open_easy(ciphertext,nonce,wrapping);
      const signingKey=eventSigningKey(signingSecret);
      assert.equal(createPublicKey(signingKey).export({format:'der',type:'spki'}).subarray(-32).toString('base64url'),context.provisioningPayload.pk_sign_event,'Control signer does not match this isolated event');
      context.securityControls=createSecurityControls({eventId:context.eventId,signingKey});
    } finally {signingSecret?.fill(0);wrapping.fill(0);nonce.fill(0);ciphertext.fill(0);}
    const revoked=context.securityControls.find(c=>c.scenario==='revoked_after_refresh');
    const revoke=await fetch(api+'/rest/v1/revocations',{method:'POST',headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json'},body:JSON.stringify({event_id:context.eventId,pass_id:revoked.pass_id,reason:'isolated signed revocation-control fixture; not a cancellation-UI observation'})});
    assert.ok(revoke.ok,'Isolated revocation control could not be seeded');
    save(contextFile,context);
    save(path.join(dir,'identity.json'),{run_id:context.runId,event_id:context.eventId,ticket_id:context.ticketId,organizer_id_hash:context.organizerIdHash,attendee_id_hash:context.attendeeIdHash,backend_instance_id:context.backendInstanceId,backend_isolation_method:context.backendIsolationMethod,commit_sha:process.env.GITHUB_SHA});
    save(path.join(dir,'backend-reset.json'),{generation:context.backendInstanceId,completed_at:new Date().toISOString(),prior_events:0,prior_auth_users:0,reset_command:'supabase db reset --workdir .focaccia/runtime --local --no-seed',proof_scope:'Fresh application/auth data in the isolated runner-local Supabase database; not a new physical server.'});
    return context;
  };
  const token=randomBytes(32).toString('base64url');
  const coordinator=await createBatchCoordinator({count,token,prepare,capture:async(index,context,result)=>{
    await captureAuthoritative(context,result);
    save(path.join(root,String(index).padStart(2,'0'),'completion.json'),result);
  }});
  await coordinator.prepareFirst();assert.equal(coordinator.getState().failure,null,'Initial isolated observation preparation failed');
  save(path.join(root,'..','coordinator.json'),{url:required('FOCACCIA_CLOUD_COORDINATOR_URL'),token,observations:count});
  save(path.join(root,'..','ready.json'),{first_observation_ready:true,observations:count});
  console.log(JSON.stringify({first_observation_ready:true,observations:count,backend_isolation:'Full database/auth reset before every observation'}));
}

async function captureAuthoritative(context,result) {
  const api=required('FOCACCIA_CLOUD_API_URL');const temp=required('RUNNER_TEMP');
  const key=readFileSync(path.join(temp,'focaccia-service-role-key'),'utf8').trim();const headers={apikey:key,authorization:'Bearer '+key};const event=encodeURIComponent(context.eventId);
  const [a,b,c]=await Promise.all([fetch(api+'/rest/v1/gate_checkins?event_id=eq.'+event+'&select=id,event_id,pass_id,decision,gate_timestamp,received_at',{headers}),fetch(api+'/rest/v1/event_tickets?event_id=eq.'+event+'&select=id,event_id,status,checked_in_at',{headers}),fetch(api+'/rest/v1/revocations?event_id=eq.'+event+'&select=pass_id,revoked_at,reason',{headers})]);
  assert.ok(a.ok&&b.ok&&c.ok,'Authoritative backend query failed before reset');
  const checkins=await a.json();const tickets=await b.json();const revocations=await c.json();
  const record={run_id:context.runId,event_id:context.eventId,backend_generation:context.backendInstanceId,captured_at:new Date().toISOString(),capture_method:'Live isolated Supabase REST queried before the next database reset',gate_checkins:checkins.length,accepted_checkins:checkins.filter(r=>r.decision==='ACCEPT').length,ticket_statuses:tickets.map(t=>({status:t.status,checked_in:Boolean(t.checked_in_at)})),checkins,tickets,revocations,native_failure:result.native_flow_exit_code===0?null:result.failure};
  save(path.join(temp,'focaccia-cloud-authoritative',context.runId+'.json'),record);
}

export async function contextServer(host, getCurrent, port = 9012) {
  const server=createServer((req,res)=>{
    if(req.url!=='/provisioning'||req.method!=='GET'){res.writeHead(404);res.end();return;}
    const current=getCurrent();if(!current){res.writeHead(503);res.end();return;}
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify(current.provisioningPayload));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
  return server;
}

async function relayReady() {
  const url=required('FOCACCIA_PROXY_HEALTH_URL');
  try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}
  const child=spawn(process.execPath,['scripts/lan-supabase-proxy.mjs'],{env:{...process.env,FOCACCIA_LOCAL_HOST:required('FOCACCIA_CLOUD_LOCAL_HOST'),FOCACCIA_LAN_PROXY_PORT:'54331',FOCACCIA_SUPABASE_UPSTREAM_URL:required('FOCACCIA_SUPABASE_UPSTREAM_URL')},stdio:'ignore'});
  writeFileSync(required('FOCACCIA_PROXY_PID_FILE'),String(child.pid)+'\n',{mode:0o600});
  for(let i=0;i<60;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{} await delay(500);}
  throw new Error('Batch relay did not recover');
}

async function native(count) {
  const root=required('FOCACCIA_CLOUD_BATCH_ROOT');const output=required('FOCACCIA_CLOUD_ARTIFACT_DIR');
  const coordinator=load(path.join(root,'..','coordinator.json'));assert.equal(coordinator.observations,count);
  const coordination=async(route,body)=>{
    const r=await fetch(coordinator.url+route,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{authorization:'Bearer '+coordinator.token,'content-type':'application/json'},signal:AbortSignal.timeout(30_000)});
    return {status:r.status,body:await r.json()};
  };
  const udid=required('FOCACCIA_IOS_SIMULATOR_UDID');
  const builds=Object.fromEntries(['ENROLLMENT','GATE'].map(name=>{
    const app=required('FOCACCIA_'+name+'_APP_PATH');const executable=path.join(app,name==='GATE'?'FacePassGate':'FacePassEnrollment');
    return [name.toLowerCase(),hash(readFileSync(executable))];
  }));
  let current=null;const results=[];
  const seen=new Set();
  for(let i=0;i<count;i++){
    const index=String(i).padStart(2,'0');let received;
    for(let attempt=0;attempt<240;attempt++){
      received=await coordination('/case/'+i);
      if(received.status===200)break;
      assert.equal(received.status,503,'Backend observation preparation failed');await delay(3000);
    }
    assert.equal(received?.status,200,'Timed out waiting for the next isolated backend observation');
    current=received.body;save(path.join(root,index,'context.json'),current);
    const dir=path.join(output,index);const started=new Date().toISOString();
    let failure=null;let exitCode=0;let erased=false;
    try{
      try{await command('xcrun',['simctl','shutdown',udid],{stdio:'ignore'});}catch{}
      await command('xcrun',['simctl','erase',udid]);erased=true;
      await command('xcrun',['simctl','boot',udid]);await command('xcrun',['simctl','bootstatus',udid,'-b']);
      await relayReady();
      await command(process.execPath,['scripts/cloud-ios-e2e.mjs'],{env:{...process.env,FOCACCIA_CLOUD_CONTEXT_PATH:path.join(root,index,'context.json'),FOCACCIA_CLOUD_ARTIFACT_DIR:dir,FOCACCIA_FRESH_SIMULATOR_STATE:'1'}});
      const report=load(path.join(dir,'native-report.json'));
      for(const field of ['run_id','event_id','ticket_id','organizer_id_hash','attendee_id_hash','pass_id','gate_device_id','gate_key_fingerprint']){
        assert.ok(report[field],'Missing observation identity: '+field);const identity=field+':'+report[field];assert.ok(!seen.has(identity),'Reused observation identity: '+field);seen.add(identity);
      }
    }catch(error){exitCode=Number.isInteger(error.status)?error.status:1;failure=error instanceof Error?error.message:'Cloud observation failed; inspect native report and job diagnostics.';}
    const result={run_id:current.runId,event_id:current.eventId,ticket_id:current.ticketId,organizer_id_hash:current.organizerIdHash,attendee_id_hash:current.attendeeIdHash,commit_sha:process.env.GITHUB_SHA,workflow_run_url:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,fresh_simulator_state:erased,mutable_state_isolated:erased,native_builds:builds,started_at:started,completed_at:new Date().toISOString(),status:exitCode===0?'PARTIAL':'FAIL',native_flow_exit_code:exitCode,failure:failure??'Base cloud flow completed; criterion acceptance still requires the full security matrix and privacy audit.'};
    save(path.join(dir,'batch-observation.json'),result);results.push(result);
    try{await command('xcrun',['simctl','shutdown',udid],{stdio:'ignore'});}catch{}
    const completion=await coordination('/complete/'+i,result);assert.equal(completion.status,200,'Backend results were not captured; do not reset or advance');
  }
  save(path.join(output,'batch-summary.json'),{observations:results,target_count:count,native_builds:builds,build_count_per_app:1,failed:results.filter(r=>r.native_flow_exit_code!==0).length});
  if(results.some(r=>r.native_flow_exit_code!==0))process.exitCode=1;
}

async function authoritative() {
  const temp=required('RUNNER_TEMP');const root=required('FOCACCIA_NATIVE_REPORT_ROOT');
  const reports=[];function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name==='native-report.json')reports.push(file);}}walk(root);
  assert.ok(reports.length,'No native reports were retained');const results=[];
  for(const file of reports){const report=load(file);const result=load(path.join(temp,'focaccia-cloud-authoritative',report.run_id+'.json'));
    assert.equal(result.event_id,report.event_id,'Authoritative event differs from native evidence');results.push(result);
  }
  save(path.join(temp,'focaccia-cloud-ios-authoritative.json'),{observations:results});
  if(results.length!==observationCount(process.env.FOCACCIA_OBSERVATIONS??'1')||results.some(r=>r.native_failure||r.gate_checkins!==1||r.accepted_checkins!==1||r.ticket_statuses.length!==1||r.ticket_statuses[0].status!=='checked_in'))process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.argv[2];const count=observationCount(process.env.FOCACCIA_OBSERVATIONS??'1');
 if(mode==='backend')await backend(count);else if(mode==='native')await native(count);else if(mode==='authoritative')await authoritative();else throw new Error('Expected backend, native or authoritative mode');
}
