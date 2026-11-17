import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

/** An ephemeral runner-only control plane; application rows are never reused. */
export async function createBatchCoordinator({count, token, prepare, capture, host='127.0.0.1', port=9013}) {
  let current=-1;let preparing=false;let failure=null;
  const contexts=new Map();const completed=new Set();let capturing=false;
  const authorized=(value)=>{const a=Buffer.from(value??'');const b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b);};
  const response=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
  async function next(index){preparing=true;try{const context=await prepare(index);contexts.set(index,context);current=index;}catch(error){failure=error instanceof Error?error.message:'Observation preparation failed';}finally{preparing=false;}}
  const server=createServer(async(req,res)=>{
    if(!authorized(req.headers.authorization)){response(res,403,{error:'Forbidden'});return;}
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/status'){response(res,200,{current,preparing,completed:[...completed],failure});return;}
    const match=url.pathname.match(/^\/(case|complete)\/(\d+)$/);
    if(!match){response(res,404,{error:'Unknown coordinator route'});return;}
    const index=Number(match[2]);if(index<0||index>=count){response(res,404,{error:'Unknown observation'});return;}
    if(match[1]==='case'&&req.method==='GET'){
      if(failure){response(res,500,{error:'Observation preparation failed; see backend diagnostics'});return;}
      if(!contexts.has(index)){response(res,503,{status:'not_ready'});return;}
      response(res,200,contexts.get(index));return;
    }
    if(match[1]!=='complete'||req.method!=='POST'){response(res,405,{error:'Unsupported method'});return;}
    if(completed.has(index)){response(res,200,{completed:index,idempotent:true});return;}
    if(index!==current||preparing||capturing){response(res,409,{error:'Observation is not the active case'});return;}
    capturing=true;
    try{
      let text='';for await(const chunk of req){text+=chunk;if(text.length>16384)throw new Error('Completion record too large');}
      const result=text?JSON.parse(text):{};
      assert.ok(result.run_id===contexts.get(index).runId,'Completion identity mismatch');
      await capture(index,contexts.get(index),result);
      completed.add(index);response(res,200,{completed:index,idempotent:false});
      if(index+1<count)void next(index+1);
    }catch(error){response(res,500,{error:'Authoritative capture failed; database preserved for diagnostics'});}
    finally{capturing=false;}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
  return {server,prepareFirst:()=>next(0),getState:()=>({current,preparing,completed:[...completed],failure})};
}
