import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createPublicKey,verify} from 'node:crypto';
import {createSecurityControls,eventSigningKey} from './lib/cloud-security-controls.mjs';
import {prepareOfflineVerification} from '../apps/gate/src/lib/offline-verifier.ts';

const pair=generateKeyPairSync('ed25519');const publicBytes=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32);
const seed=pair.privateKey.export({format:'der',type:'pkcs8'}).subarray(-32);const reconstructed=eventSigningKey(Buffer.concat([seed,publicBytes]));
const now=new Date('2026-11-17T12:00:00Z');const controls=createSecurityControls({eventId:'isolated-fixture',signingKey:reconstructed,nowUnix:now.getTime()/1000});
test('isolated signing key reconstruction retains the original public key',()=>assert.deepEqual(createPublicKey(reconstructed).export({format:'der',type:'spki'}),pair.publicKey.export({format:'der',type:'spki'})));
test('controls have independent pass identities and authentic signatures except the deliberate tamper',()=>{
 assert.equal(new Set(controls.map(c=>c.pass_id)).size,4);
 for(const c of controls){const [p,s]=c.token.split('.');assert.equal(verify(null,Buffer.from(p,'base64url'),pair.publicKey,Buffer.from(s,'base64url')),c.scenario!=='tampered');}
});
for(const c of controls)test('real gate verifier rejects '+c.scenario+' with '+c.expected_reason,async()=>{
 const event={event_id:'isolated-fixture',event_name:'Controlled fixture',pk_sign_event:publicBytes.toString('base64url'),pk_gate_event:Buffer.alloc(32,1).toString('base64url'),event_salt:Buffer.alloc(32,2).toString('base64url'),starts_at:'2026-11-17T00:00:00Z',ends_at:'2026-11-18T23:00:00Z',gate_device_id:'fixture-device',key_version:1,last_revocation_sync_at:now.toISOString(),provisioned_at:now.toISOString(),sync_public_key:null,policy:{match_threshold:80,liveness_timeout_ms:20000,single_entry:true,typed_token_fallback:true,queue_code_enabled:false}};
 const result=await prepareOfflineVerification({event,token:c.token,gatePrivateKey:new Uint8Array(32),now,checkReplay:async()=>false,checkRevoked:async(id)=>c.scenario==='revoked_after_refresh'&&id===c.pass_id});
 assert.equal(result.ok,false);assert.equal(result.decision.reasonCode,c.expected_reason);
});
