import assert from 'node:assert/strict';
import test from 'node:test';
import {createBatchCoordinator} from './lib/cloud-batch-coordinator.mjs';
import {setTimeout as delay} from 'node:timers/promises';

test('coordinator captures each result before preparing a clean next observation and is retry-safe',async(t)=>{
 const actions=[];const token='fixture-control-only';const c=await createBatchCoordinator({count:2,token,port:0,prepare:async(i)=>{actions.push('reset-'+i);return{runId:'fixture-'+i};},capture:async(i)=>{actions.push('capture-'+i);}});
 t.after(()=>new Promise(resolve=>c.server.close(resolve)));await c.prepareFirst();const url='http://127.0.0.1:'+c.server.address().port;const headers={authorization:'Bearer '+token,'content-type':'application/json'};
 assert.equal((await fetch(url+'/case/0')).status,403);assert.equal((await fetch(url+'/case/1',{headers})).status,503);
 const first=await fetch(url+'/complete/0',{method:'POST',headers,body:JSON.stringify({run_id:'fixture-0',status:'FAIL'})});assert.equal(first.status,200);
 for(let i=0;i<20&&!c.getState().completed.includes(0);i++)await delay(5);
 assert.deepEqual(actions,['reset-0','capture-0','reset-1']);
 const retry=await fetch(url+'/complete/0',{method:'POST',headers,body:JSON.stringify({run_id:'fixture-0'})});assert.equal((await retry.json()).idempotent,true);assert.equal(actions.length,3);
 assert.deepEqual(await(await fetch(url+'/case/1',{headers})).json(),{runId:'fixture-1'});
});
test('failed authoritative capture prevents a reset and preserves the active database',async(t)=>{
 const actions=[];const c=await createBatchCoordinator({count:2,token:'fixture',port:0,prepare:async(i)=>{actions.push('reset-'+i);return{runId:'run-'+i};},capture:async()=>{throw Error('synthetic capture failure');}});
 t.after(()=>new Promise(resolve=>c.server.close(resolve)));await c.prepareFirst();const url='http://127.0.0.1:'+c.server.address().port;
 const r=await fetch(url+'/complete/0',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify({run_id:'run-0'})});assert.equal(r.status,500);assert.deepEqual(actions,['reset-0']);
});
