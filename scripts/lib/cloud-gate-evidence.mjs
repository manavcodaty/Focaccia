import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './baguette-client.mjs';

async function locateDatabase(directory) {
  let entries;
  try { entries=await readdir(directory,{withFileTypes:true}); } catch { return null; }
  for(const entry of entries) {
    const file=path.join(directory,entry.name);
    if(entry.isFile()&&entry.name==='face-pass-gate.db')return file;
    if(entry.isDirectory()){const found=await locateDatabase(file);if(found)return found;}
  }
  return null;
}

export function publicSnapshot(gate, queue, used, observedAt) {
  assert.ok(gate?.event_id&&gate.gate_device_id&&gate.sync_public_key,'Public gate identity is missing');
  return {
    observed_at:observedAt,event_id:gate.event_id,gate_device_id:gate.gate_device_id,
    gate_key_fingerprint:createHash('sha256').update(Buffer.from(gate.sync_public_key,'base64url')).digest('hex'),
    revocation_refreshed_at:gate.last_revocation_sync_at,
    used_passes:used,
    queue:queue.map(({event_id,pass_id,decision,gate_timestamp,status,attempt_count,synced_at})=>({event_id,pass_id,decision,gate_timestamp,status,attempt_count,synced_at})),
  };
}

export async function captureGateState(udid, file) {
  const container=(await runCommand('xcrun',['simctl','get_app_container',udid,'com.facepass.gate','data'])).stdout.trim();
  const database=await locateDatabase(path.join(container,'Documents'))??await locateDatabase(path.join(container,'Library'));
  assert.ok(database,'Gate SQLite database is unavailable');
  const query=async(sql)=>JSON.parse((await runCommand('sqlite3',['-readonly','-json',database,sql])).stdout||'[]');
  const [gates,queue,used]=await Promise.all([
    query('select event_id,gate_device_id,sync_public_key,last_revocation_sync_at from gate_config limit 1'),
    query('select event_id,pass_id,decision,gate_timestamp,idempotency_key,nonce,signature,status,attempt_count,synced_at from checkin_sync_queue'),
    query('select event_id,pass_id,accepted_at from used_passes'),
  ]);
  const snapshot=publicSnapshot(gates[0],queue,used,new Date().toISOString());
  await writeFile(file,JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
  return {snapshot,signedRequests:queue.map(({event_id,pass_id,decision,gate_timestamp,idempotency_key,nonce,signature})=>({event_id,pass_id,decision,gate_timestamp,idempotency_key,nonce,signature}))};
}
