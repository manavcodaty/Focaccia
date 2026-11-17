import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { observationCount, contextServer, runCloudCommand } from './cloud-sc1-sc5-batch.mjs';
import { loadCloudProvisioning } from '../apps/gate/src/lib/cloud-e2e-provisioning.ts';

test('bounded validation and batch counts only',()=>{
  assert.equal(observationCount('1'),1);assert.equal(observationCount('2'),2);assert.equal(observationCount('10'),10);
  for(const invalid of ['0','3','11','01','100','-1','NaN',''])assert.throws(()=>observationCount(invalid));
});
test('production mode never fetches even when a context URL is supplied',async()=>{
  const result=await loadCloudProvisioning({enabled:false,contextUrl:'http://10.0.0.1:9012/provisioning',fetchImpl:()=>{throw Error('Production fetched a fixture');}});assert.equal(result,null);
});
test('legacy encoded fixture remains supported without a network call',async()=>{
  assert.equal(await loadCloudProvisioning({enabled:true,encodedPayload:encodeURIComponent('{"event_id":"fixture"}'),fetchImpl:()=>{throw Error('Unexpected network');}}),'{"event_id":"fixture"}');
});
test('fixture loader restricts protocol, private IPv4, route and port',async()=>{
  for(const contextUrl of ['https://10.0.0.1:9012/provisioning','http://example.com:9012/provisioning','http://10.example.com:9012/provisioning','http://127.0.0.1:9012/provisioning','http://10.0.0.1:9013/provisioning','http://10.0.0.1:9012/other','http://user@10.0.0.1:9012/provisioning','http://10.0.0.1:9012/provisioning?x=1'])await assert.rejects(()=>loadCloudProvisioning({enabled:true,contextUrl,fetchImpl:()=>{throw Error('Invalid URL was fetched');}}));
});
test('fixture fetch uses abort signal and does not cache provisioning data',async()=>{
  const controller=new AbortController();let observed;
  const result=await loadCloudProvisioning({enabled:true,contextUrl:'http://10.0.0.1:9012/provisioning',signal:controller.signal,fetchImpl:async(url,options)=>{observed=options;return new Response('{"event_id":"fixture"}',{status:200});}});
  assert.deepEqual(JSON.parse(result),{event_id:'fixture'});assert.equal(observed.signal,controller.signal);assert.equal(observed.cache,'no-store');
});
test('HTTP fixture server exposes provisioning only and switches between isolated cases',async(t)=>{
  let current={provisioningPayload:{event_id:'one'},attendeePassword:'synthetic-only'};
  const server=await contextServer('127.0.0.1',()=>current,0);t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  const first=await fetch(url+'/provisioning');assert.equal(first.headers.get('cache-control'),'no-store');assert.deepEqual(await first.json(),{event_id:'one'});
  current={provisioningPayload:{event_id:'two'}};assert.deepEqual(await(await fetch(url+'/provisioning')).json(),{event_id:'two'});
  assert.equal((await fetch(url+'/context')).status,404);
});
test('candidate runs native build steps once and uses simulator erase for each observation',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/cloud-ios-full-flow.yml',import.meta.url),'utf8');
  assert.equal((yaml.match(/name: Build Enrollment for/g)||[]).length,1);assert.equal((yaml.match(/name: Build Gate for/g)||[]).length,1);
  assert.match(yaml,/node scripts\/cloud-sc1-sc5-batch\.mjs native/);assert.match(yaml,/retention-days: 1/);
  const driver=readFileSync(new URL('./cloud-sc1-sc5-batch.mjs',import.meta.url),'utf8');assert.match(driver,/\['simctl','erase',udid\]/);assert.match(driver,/for\(let i=0;i<count;i\+\+\)/);
});
test('native subprocess can fetch its fixture while the parent waits; no event-loop deadlock',async(t)=>{
 const server=await contextServer('127.0.0.1',()=>({provisioningPayload:{event_id:'fixture-child'}}),0);t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port+'/provisioning';
 await runCloudCommand(process.execPath,['-e',`fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(1500)}).then(r=>r.json()).then(x=>{if(x.event_id!=='fixture-child')process.exit(1)}).catch(()=>process.exit(1))`],{stdio:'ignore'});
});
