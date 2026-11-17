import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { canonicalJsonBytes } from '../../packages/shared/dist/canonical-json.js';

export function eventSigningKey(secret) {
  if (!(secret instanceof Uint8Array) || secret.length !== 64) throw new Error('Expected the isolated event Ed25519 secret key.');
  return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(secret.subarray(0,32))]),format:'der',type:'pkcs8' });
}

export function createSecurityControls({eventId, signingKey, nowUnix=Math.floor(Date.now()/1000)}) {
  const make=(scenario,change,reason)=>{
    const payload={v:1,event_id:eventId,iat:nowUnix-120,exp:nowUnix+24*60*60,pass_id:randomBytes(16).toString('base64url'),nonce:randomBytes(12).toString('base64url'),enc_template:randomBytes(96).toString('base64url'),single_use:true,...change};
    const bytes=canonicalJsonBytes(payload);const signature=sign(null,bytes,signingKey);
    if(scenario==='tampered')signature[0]^=1;
    return {scenario,pass_id:payload.pass_id,token:Buffer.from(bytes).toString('base64url')+'.'+signature.toString('base64url'),expected_reason:reason,fixture_origin:'isolated-event-key-signed adversarial fixture with random non-biometric encrypted-template placeholder; early rejection guard only'};
  };
  return [make('tampered',{},'BAD_SIGNATURE'),make('wrong_event',{event_id:eventId+'-other'},'WRONG_EVENT'),make('expired',{iat:nowUnix-120,exp:nowUnix-60},'EXPIRED'),make('revoked_after_refresh',{},'REVOKED')];
}
