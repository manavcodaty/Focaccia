import assert from 'node:assert/strict';
import test from 'node:test';
import { settleHostedInput } from './lib/cloud-input-retry.mjs';

test('an acknowledgement timeout does not discard a value actually applied by the simulator', async () => {
  const events=[];let typed=false;const expected='synthetic-private-input';
  await settleHostedInput({expected,label:'fixture field',paste:async()=>{throw Error('Timed out waiting for paste');},type:async()=>{typed=true;},read:async()=>expected,record:async e=>events.push(e),readTimeoutMs:0});
  assert.equal(typed,false);assert.equal(events[0].outcome,'MATCH');assert.match(events[0].transport_error,/Timed out/);assert.ok(!JSON.stringify(events).includes(expected));
});
test('a failed paste is followed by bounded deterministic typing for short inputs', async () => {
  const events=[];let value='';let pastes=0;let types=0;
  await settleHostedInput({expected:'fixture value',label:'field',paste:async()=>{pastes++;throw Error('paste acknowledgement timeout');},type:async()=>{types++;value='fixture value';},read:async()=>value,record:async e=>events.push(e),readTimeoutMs:0});
  assert.equal(pastes,1);assert.equal(types,1);assert.deepEqual(events.map(e=>e.outcome),['NOT_MATCHED','MATCH']);
});
test('exhaustion preserves all attempts without leaking a credential echoed by a transport error',async()=>{
  const events=[];const expected='synthetic-private-input';
  await assert.rejects(()=>settleHostedInput({expected,label:'field',paste:async()=>{throw Error('could not enter '+expected);},type:async()=>{},read:async()=>'',record:async e=>events.push(e),readTimeoutMs:0}),/three|3 bounded attempts/);
  assert.equal(events.length,3);assert.ok(!JSON.stringify(events).includes(expected));
});
test('long signed-token input keeps bounded paste retries instead of unbounded character typing',async()=>{
  const expected='x'.repeat(200);let pastes=0;let value='';
  await settleHostedInput({expected,label:'token',paste:async()=>{if(++pastes===2)value=expected;},type:async()=>{throw Error('Long typing must not run');},read:async()=>value,readTimeoutMs:0});assert.equal(pastes,2);
});
