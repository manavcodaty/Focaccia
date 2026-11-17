import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function observationCount(raw) {
  assert.ok(raw === '1' || raw === '2' || raw === '10', 'Observation count must be 1 (smoke), 2 (reuse validation) or 10 (batch).');
  return Number(raw);
}
const required = (key) => { assert.ok(process.env[key], `${key} is required`); return process.env[key]; };
const save = (file, data) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data, null, 2)+'\n', { mode: 0o600 }); };
const load = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const command = (exe, args, options = {}) => execFileSync(exe, args, { stdio: 'inherit', ...options });

async function backend(count) {
  const api = required('FOCACCIA_CLOUD_API_URL');
  const anon = required('FOCACCIA_CLOUD_ANON_KEY');
  const temp = required('RUNNER_TEMP');
  const instance = required('GITHUB_RUN_ID');
  const service = readFileSync(path.join(temp, 'focaccia-service-role-key'), 'utf8').trim();
  const root = path.join(temp, 'focaccia-cloud-batch', 'observations');
  for (let i=0;i<count;i++) {
    const index=String(i).padStart(2,'0');const email=`batch-${instance}-${index}@example.com`;
    const password='Batch-'+randomBytes(24).toString('base64url')+'!';
    if(process.env.GITHUB_ACTIONS==='true') console.log(`::add-mask::${password}`);
    const signup=await fetch(api+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email,password})});
    assert.ok(signup.ok,`Batch organizer signup failed: HTTP ${signup.status}`);
    const auth=await signup.json();assert.ok(auth.access_token,'Batch organizer session is missing');
    const provision=await fetch(api+'/functions/v1/ensure-organizer',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+auth.access_token,'content-type':'application/json'},body:'{}'});
    assert.ok(provision.ok,`Batch organizer authority failed: HTTP ${provision.status}`);
    const dir=path.join(root,index);const contextFile=path.join(dir,'context.json');
    command(process.execPath,['scripts/cloud-browser-e2e.mjs'],{env:{...process.env,FOCACCIA_CLOUD_BATCH:'1',FOCACCIA_CLOUD_ORGANIZER_EMAIL:email,FOCACCIA_CLOUD_ORGANIZER_PASSWORD:password,FOCACCIA_CLOUD_CONTEXT_PATH:contextFile,FOCACCIA_CLOUD_ARTIFACT_DIR:path.join(dir,'browser')}});
    const context=load(contextFile);
    const response=await fetch(api+'/rest/v1/event_tickets?event_id=eq.'+encodeURIComponent(context.eventId)+'&select=id,attendee_user_id',{headers:{apikey:service,authorization:'Bearer '+service}});
    assert.ok(response.ok,`Batch identity query failed: HTTP ${response.status}`);
    const tickets=await response.json();assert.equal(tickets.length,1,'Expected one ticket per isolated event');
    const foreignSignup=await fetch(api+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email:`foreign-${context.runId}@example.com`,password:'Foreign-'+randomBytes(24).toString('base64url')+'!'})});
    assert.ok(foreignSignup.ok,'Foreign-owner test setup failed');const foreign=await foreignSignup.json();assert.ok(foreign.access_token,'Foreign-owner session is missing');
    const forbidden=await fetch(api+'/functions/v1/get-enrollment-bundle',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+foreign.access_token,'content-type':'application/json'},body:JSON.stringify({ticket_id:tickets[0].id})});
    const forbiddenBody=await forbidden.json();assert.equal(forbidden.status,404);assert.equal(forbiddenBody.error?.code,'ticket_not_found');
    save(path.join(dir,'ownership-check.json'),{expected:'REJECT',observed:'REJECT',http_status:forbidden.status,reason_code:forbiddenBody.error.code,timestamp:new Date().toISOString(),ticket_id:tickets[0].id});
    context.foreignTicketRejected=true;
    Object.assign(context,{ticketId:tickets[0].id,organizerIdHash:hash(context.runId+':'+auth.user.id),attendeeIdHash:hash(context.runId+':'+tickets[0].attendee_user_id),backendInstanceId:instance});
    save(contextFile,context);
    save(path.join(dir,'identity.json'),{run_id:context.runId,event_id:context.eventId,ticket_id:context.ticketId,organizer_id_hash:context.organizerIdHash,attendee_id_hash:context.attendeeIdHash,backend_instance_id:instance,commit_sha:process.env.GITHUB_SHA});
  }
  console.log(JSON.stringify({prepared_observations:count,backend_instance:instance}));
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
  const directories=readdirSync(root).filter(x=>existsSync(path.join(root,x,'context.json'))).sort();
  assert.equal(directories.length,count,'Backend case count must match requested observations');
  const udid=required('FOCACCIA_IOS_SIMULATOR_UDID');
  const builds=Object.fromEntries(['ENROLLMENT','GATE'].map(name=>{
    const app=required('FOCACCIA_'+name+'_APP_PATH');const executable=path.join(app,name==='GATE'?'FacePassGate':'FacePassEnrollment');
    return [name.toLowerCase(),hash(readFileSync(executable))];
  }));
  let current=null;const server=await contextServer(required('FOCACCIA_CLOUD_LOCAL_HOST'),()=>current);const results=[];
  try{for(const index of directories){
    current=load(path.join(root,index,'context.json'));const dir=path.join(output,index);const started=new Date().toISOString();
    let failure=null;let exitCode=0;let erased=false;
    try{
      try{command('xcrun',['simctl','shutdown',udid],{stdio:'ignore'});}catch{}
      command('xcrun',['simctl','erase',udid]);erased=true;
      command('xcrun',['simctl','boot',udid]);command('xcrun',['simctl','bootstatus',udid,'-b']);
      await relayReady();
      command(process.execPath,['scripts/cloud-ios-e2e.mjs'],{env:{...process.env,FOCACCIA_CLOUD_CONTEXT_PATH:path.join(root,index,'context.json'),FOCACCIA_CLOUD_ARTIFACT_DIR:dir,FOCACCIA_FRESH_SIMULATOR_STATE:'1'}});
    }catch(error){exitCode=Number.isInteger(error.status)?error.status:1;failure=error instanceof Error?error.message:'Cloud observation failed; inspect native report and job diagnostics.';}
    const result={run_id:current.runId,event_id:current.eventId,ticket_id:current.ticketId,organizer_id_hash:current.organizerIdHash,attendee_id_hash:current.attendeeIdHash,commit_sha:process.env.GITHUB_SHA,workflow_run_url:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,fresh_simulator_state:erased,mutable_state_isolated:erased,native_builds:builds,started_at:started,completed_at:new Date().toISOString(),status:exitCode===0?'PARTIAL':'FAIL',native_flow_exit_code:exitCode,failure:failure??'Base cloud flow completed; criterion acceptance still requires the full security matrix and privacy audit.'};
    save(path.join(dir,'batch-observation.json'),result);results.push(result);
  }}finally{await new Promise(resolve=>server.close(resolve));}
  save(path.join(output,'batch-summary.json'),{observations:results,target_count:count,native_builds:builds,build_count_per_app:1,failed:results.filter(r=>r.native_flow_exit_code!==0).length});
  if(results.some(r=>r.native_flow_exit_code!==0))process.exitCode=1;
}

async function authoritative() {
  const temp=required('RUNNER_TEMP');const root=required('FOCACCIA_NATIVE_REPORT_ROOT');
  const api=required('FOCACCIA_CLOUD_API_URL');const key=readFileSync(path.join(temp,'focaccia-service-role-key'),'utf8').trim();
  const reports=[];function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name==='native-report.json')reports.push(file);}}walk(root);
  assert.ok(reports.length,'No native reports were retained');const results=[];
  for(const file of reports){const report=load(file);const event=encodeURIComponent(report.event_id);const headers={apikey:key,authorization:'Bearer '+key};
    const [a,b]=await Promise.all([fetch(api+'/rest/v1/gate_checkins?event_id=eq.'+event+'&select=id,event_id,pass_id,decision,received_at',{headers}),fetch(api+'/rest/v1/event_tickets?event_id=eq.'+event+'&select=id,event_id,status,checked_in_at',{headers})]);
    assert.ok(a.ok&&b.ok,'Authoritative backend query failed');const checkins=await a.json();const tickets=await b.json();
    const result={run_id:report.run_id,event_id:report.event_id,gate_checkins:checkins.length,accepted_checkins:checkins.filter(r=>r.decision==='ACCEPT').length,ticket_statuses:tickets.map(t=>({status:t.status,checked_in:Boolean(t.checked_in_at)})),native_failure:report.failure};
    results.push(result);save(path.join(temp,'focaccia-cloud-authoritative',report.run_id+'.json'),result);
  }
  save(path.join(temp,'focaccia-cloud-ios-authoritative.json'),{observations:results});
  if(results.some(r=>r.gate_checkins!==1||r.accepted_checkins!==1||r.ticket_statuses.length!==1||r.ticket_statuses[0].status!=='checked_in'))process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.argv[2];const count=observationCount(process.env.FOCACCIA_OBSERVATIONS??'1');
 if(mode==='backend')await backend(count);else if(mode==='native')await native(count);else if(mode==='authoritative')await authoritative();else throw new Error('Expected backend, native or authoritative mode');
}
