import fs from 'node:fs/promises';
import http from 'node:http';
const root='/Users/manavcodaty/repos/Focaccia/output/epq-story-redesign';
const master=`${root}/Focaccia - EPQ Story.excalidraw`;
const html=`<!doctype html><html><head><meta charset="utf-8"><title>Focaccia EPQ Story · Excalidraw</title>
<link rel="stylesheet" href="https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/index.css">
<style>html,body{margin:0;height:100%;font-family:system-ui;background:#fffdf8}header{height:52px;display:flex;gap:16px;align-items:center;padding:0 20px}#editor{height:calc(100% - 52px)}button,select{font:inherit;padding:5px 10px}#status{font-size:13px}</style></head>
<body><header><label for="frames">Frame</label><select id="frames"></select><button id="show">Show frame</button><button id="save">Save new master</button><span id="status">Loading Excalidraw…</span></header><div id="editor"></div>
<script type="module">
import React from 'https://esm.sh/react@19.0.0';
import {createRoot} from 'https://esm.sh/react-dom@19.0.0/client';
import {Excalidraw,serializeAsJSON} from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?deps=react@19.0.0,react-dom@19.0.0';
const scene=await(await fetch('/scene')).json();let api;
const frames=scene.elements.filter(e=>e.type==='frame');
for(const f of frames){const o=document.createElement('option');o.value=f.id;o.textContent=f.name;document.querySelector('#frames').append(o)}
const show=()=>{const id=document.querySelector('#frames').value;const els=api.getSceneElements().filter(e=>e.id===id||e.frameId===id);api.scrollToContent(els,{fitToContent:true,animate:false,viewportZoomFactor:.85});document.querySelector('#status').textContent='Viewing '+frames.find(f=>f.id===id).name};
document.querySelector('#show').onclick=show;
document.querySelector('#save').onclick=async()=>{const data=serializeAsJSON(api.getSceneElements(),api.getAppState(),api.getFiles(),'local');const r=await fetch('/scene',{method:'PUT',headers:{'Content-Type':'application/json'},body:data});document.querySelector('#status').textContent= r.ok?'Master saved':'Save failed'};
createRoot(document.querySelector('#editor')).render(React.createElement(Excalidraw,{initialData:{...scene,appState:{...scene.appState,theme:'light'}},excalidrawAPI:a=>{api=a;setTimeout(show,350)},theme:'light'}));
</script></body></html>`;
const server=http.createServer(async(req,res)=>{
 try{
 if(req.url==='/scene'){
  if(req.method==='PUT'){
   let data='';for await(const chunk of req){data+=chunk;if(data.length>3e6)throw new Error('Scene too large')}
   const s=JSON.parse(data);if(s.type!=='excalidraw'||s.elements.filter(e=>e.type==='frame'&&!e.isDeleted).length!==17)throw new Error('Invalid scene');
   await fs.writeFile(master,JSON.stringify(s,null,2)+'\n');res.end('saved');return;
  }
  res.setHeader('Content-Type','application/json');res.end(await fs.readFile(master));return;
 }
 res.setHeader('Content-Type','text/html');res.end(html);
 }catch(e){res.statusCode=400;res.end(e.message)}
});
server.listen(8891,'127.0.0.1',()=>console.log('Excalidraw editor: http://127.0.0.1:8891'));
