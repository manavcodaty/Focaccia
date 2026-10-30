import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {slides,qa,N} from './content.mjs';

const ROOT='/Users/manavcodaty/repos/Focaccia';
const OUT=`${ROOT}/output/privatepass-diagram-edition`;
const BUILD=`${ROOT}/.codex-tmp/privatepass-diagram-edition`;
await fs.mkdir(`${OUT}/svg`,{recursive:true});
await fs.mkdir(`${BUILD}/previews`,{recursive:true});
const C='#202020',R='#b4493d',BG='#fffdf8';
let elements=[],local=[],n=0,serial=0,offsetX=0,offsetY=0;
function add(type,x,y,width,height,extra={}){
 const id=`story-${n}-${++serial}`;
 const e={id,type,x:x+offsetX,y:y+offsetY,width,height,strokeColor:C,backgroundColor:'transparent',strokeWidth:2,roughness:1,opacity:100,fillStyle:'solid',strokeStyle:'solid',angle:0,groupIds:[],frameId:`story-frame-${n}`,isDeleted:false,locked:false,seed:1000+serial,version:1,versionNonce:1000+serial,...extra};
 local.push(e);return id;
}
function text(label,cx,y,max=900,size=42,color=C,owner=null){
 return add('text',cx,y,0,0,{text:label,fontSize:size,fontFamily:1,textAlign:'center',verticalAlign:'top',strokeColor:color,customData:{slot:{cx:cx+offsetX,y:y+offsetY,max},owner}});
}
function line(points,dashed=false,extra={}){
 const [x,y]=points[0],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return add('line',x,y,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),{points:points.map(p=>[p[0]-x,p[1]-y]),strokeStyle:dashed?'dashed':'solid',...extra});
}
function arrow(points,dashed=false){const id=line(points,dashed);local.at(-1).type='arrow';local.at(-1).endArrowhead='arrow';local.at(-1).startArrowhead=null;return id;}
function box(label,x,y,w,h,size=42,kind='rectangle',dashed=false){
 const id=add(kind,x,y,w,h,{roundness:kind==='rectangle'?{type:3}:null,strokeStyle:dashed?'dashed':'solid'});
 if(label)text(label,x+w/2,y+(h-label.split('\n').length*size*1.25)/2,w-64,size,C,id);
 return id;
}
function face(cx,y,r=65){
 const id=add('ellipse',cx-r,y,r*2,r*2);
 line([[cx-r*.35,y+r*.72],[cx-r*.27,y+r*.72]],false,{customData:{intentionalIcon:true,owner:id}});
 line([[cx+r*.27,y+r*.72],[cx+r*.35,y+r*.72]],false,{customData:{intentionalIcon:true,owner:id}});
 line([[cx-r*.32,y+r*1.3],[cx,y+r*1.42],[cx+r*.32,y+r*1.3]],false,{customData:{intentionalIcon:true,owner:id}});
 return id;
}
function envelope(label,x,y,w=370,h=240){
 const id=box('',x,y,w,h);
 line([[x+12,y+12],[x+w/2,y+85],[x+w-12,y+12]],false,{customData:{intentionalIcon:true,owner:id}});
 text(label,x+w/2,y+120,w-64,38,C,id);
 return id;
}
function start(slide){n=slide;serial=0;offsetX=((n-1)%4)*1800;offsetY=Math.floor((n-1)/4)*1050;local=[];
 elements.push({id:`story-frame-${n}`,type:'frame',x:offsetX,y:offsetY,width:1600,height:900,name:`Slide ${String(n).padStart(2,'0')}`,angle:0,strokeColor:C,backgroundColor:'transparent',fillStyle:'solid',strokeWidth:1,strokeStyle:'solid',roughness:0,opacity:100,groupIds:[],frameId:null,isDeleted:false,locked:false,seed:100+n,version:1,versionNonce:100+n,customData:{...slides[n-1],qa:n===19?qa:undefined}});
 add('rectangle',0,0,1600,900,{strokeColor:BG,backgroundColor:BG,roughness:0,strokeWidth:0,customData:{background:true}});
}
function finish(){elements.push(...local);}

// The source deck supplies the order and words; only the visual language changes.
start(1);
text('Private Pass',800,95,1000,64);
box('One ticket',130,285,350,190,48);
face(800,285,75);text('One person',800,485,450,42);
box('Gate checks\nNo internet',1100,285,370,190,42);
arrow([[530,380],[665,380]]);arrow([[925,380],[1050,380]]);
text('No central face database',800,680,1250,46);
text('A prepared prototype',800,770,1000,34,R);
finish();

start(2);
box('QR ticket',130,175,470,180,48);
arrow([[365,395],[365,465]]);
text('A copy can be shared',365,520,610,40);
box('Central face\ndatabase',1000,175,470,180,44);
arrow([[1235,395],[1235,465]]);
text('Lasting data at risk',1235,520,610,40);
text('Private Pass: link the ticket to its holder',800,680,1400,44);
text('Keep face checks on the phones',800,765,1300,40);
finish();

start(3);
text('One person\nOne ticket',300,170,500,48);
text('Prepared gate\nNo internet needed',1250,170,550,44);
box('Success needs\nall four',580,390,440,180,46,'ellipse');
text('No central reusable\nface records',300,695,550,42);
text('Saved tests\nand honest limits',1250,695,550,42);
line([[475,305],[605,365]]);line([[1125,305],[995,365]]);
line([[475,650],[605,595]]);line([[1125,650],[995,595]]);
finish();

start(4);
const stageX=[310,800,1290];
const stageLabels=['Build the base','Connect the parts','Fix and improve'];
const stageDetail=['Camera\nPrivacy design','Tickets\nOffline checks','Login + network\nApp screens'];
for(let i=0;i<3;i++){
 text(stageLabels[i],stageX[i],205,460,40);
 box(stageDetail[i],stageX[i]-190,325,380,220,38);
 if(i<2)arrow([[stageX[i]+215,435],[stageX[i+1]-215,435]]);
}
text('Supervisor: how does someone get a ticket?',800,100,1380,38);
text('Adding ticketing made the journey complete',800,650,1380,40);
text('More features left less time for testing',800,755,1380,38,R);
finish();

start(5);
const researchRows=[
 ['Faces can become\ncomparable numbers','Compare one person\nwith one ticket'],
 ['Face numbers can\nstill reveal information','Protect differently\nfor each event'],
 ['An issuer’s stamp\nreveals changes','Check genuine passes\nwithout internet']
];
for(let i=0;i<3;i++){
 const y=140+i*220;text(researchRows[i][0],430,y,650,40);
 arrow([[805,y+48],[955,y+48]]);
 text(researchRows[i][1],1240,y,540,40);
}
text('Research guides the design. It is not my test result.',800,770,1440,32,R);
finish();

start(6);
const roles=['Organiser','Ticket website','Enrolment phone','Gate phone'];
const acts=['Create\nevent','Claim\nticket','Scan face\nMake pass','Check pass\n+ face'];
const relayX=[250,615,980,1345];
for(let i=0;i<4;i++){
 text(roles[i],relayX[i],220,330,35);
 box(acts[i],relayX[i]-150,345,300,200,36);
 if(i<3)arrow([[relayX[i]+165,445],[relayX[i+1]-165,445]]);
}
text('Earlier steps need a connection',615,675,1050,40);
text('Final check can work offline',1160,775,740,36);
finish();

start(7);
text('Attendee phone',315,120,450,44);text('Event service',800,120,450,44);text('Prepared gate',1285,120,450,44);
text('Processes face',315,230,450,38);text('Checks ticket',800,230,450,36);text('Reads and compares',1285,230,450,34);
envelope('Protected\nface record',130,345);
envelope('Still\nlocked',615,345);
box('Face record\n+ fresh scan\nCheck locally',1100,345,370,240,36);
arrow([[530,465],[585,465]]);arrow([[1015,465],[1070,465]]);
text('Changed per event',315,675,440,32);
text('Accounts, events\nand tickets stored',800,655,450,32);
text('Checks on this phone',1285,675,450,32);
text('Less central face data does not mean zero risk',800,775,1380,34,R);
finish();

start(8);
face(300,155,70);text('Person at the gate',300,345,500,38);
box('Face record\non this pass',1050,160,420,195,44);
arrow([[425,270],[635,440]]);arrow([[1050,395],[965,440]]);
box('Compare\nthis pair',580,480,440,180,46,'ellipse');
line([[170,750],[1430,750]],true);
text('Too loose',330,680,440,36);text('Too strict',1260,680,440,36);
text('Wrong person gets in',330,775,500,32,R);
text('Right person rejected',1260,775,520,32,R);
finish();

start(9);
text('Signature',420,120,580,50);text('Encryption',1180,120,580,50);
envelope('Issuer’s\nstamp',190,280,460,250);
envelope('Locked\nface record',950,280,460,250);
text('Genuine pass?\nHas it changed?',420,590,630,42);
text('Who can read\ninside?',1180,590,630,42);
text('A valid pass still needs a matching person',800,755,1380,38);
finish();

start(10);
text('Prepare online, then disconnect',800,105,1380,44);
text('Right event + time\nGenuine pass\nNot cancelled or used\nMatching face',440,300,700,42);
arrow([[850,425],[995,425]]);
box('Allow entry\nRemember used',1040,320,440,215,42,'ellipse');
text('Same pass again? Reject at this gate.',800,650,1350,42);
text('New cancellations wait for reconnection',800,755,1350,38,R);
finish();

start(11);
const fixes=[
 ['Different face crops','Use the same crop rules'],
 ['Reply lost. Tap again?','Same request, same ticket'],
 ['App stops after success?','Save use before success']
];
for(let i=0;i<3;i++){
 const y=170+i*245;text(fixes[i][0],440,y,680,40);
 arrow([[840,y+28],[960,y+28]]);
 text(fixes[i][1],1240,y,550,38);
 if(i<2)line([[130,y+145],[1470,y+145]],true);
}
finish();

start(12);
text('Saved checks\n15 June',430,115,650,46);
text('Not established\non the final version',1190,115,650,44);
line([[800,130],[800,685]],true);
text('Ticket claims + access\nSafe retries\nSignatures + reuse\nSync + cancellation rules\niPhone launch + local Wi-Fi',430,315,650,38);
text('Detailed full-phone receipt\nFace accuracy + fairness\nPhoto or screen resistance\nQueue timings + user study',1190,315,650,36);
text('Bugs fixed: crop rules, safe retries, save before success',800,705,1400,34);
text('Software checks do not prove the full physical journey',800,775,1400,34,R);
finish();

start(13);
const evidence=[
 ['Recorded','Software, browser, network checks\nApps launched on an iPhone'],
 ['Later observed','I saw the full journey work\nDetailed final record missing'],
 ['Not measured','Face performance, queue speed\nUser experience, public rollout']
];
for(let i=0;i<3;i++){
 const y=145+i*245;text(evidence[i][0],315,y+25,450,44,i===2?R:C);
 text(evidence[i][1],1070,y,860,40);
 if(i<2)line([[130,y+155],[1470,y+155]],true);
}
finish();

start(14);
text('Planned demo: follow what actually happens',800,115,1400,42);
const demoX=[245,615,985,1355];
const demoActs=['Prepare\nDisconnect','Scan once\nAccept?','Scan again\nReject?','Reconnect\nSync?'];
for(let i=0;i<4;i++){
 box(demoActs[i],demoX[i]-135,350,270,200,39);
 if(i<3)arrow([[demoX[i]+160,450],[demoX[i+1]-160,450]]);
}
text('Download event information before disconnecting',800,670,1400,38);
text('A demonstration does not replace saved test data',800,775,1400,34,R);
finish();

start(15);
const results=[['Offline gate decisions','Partly evidenced'],['Stop ticket reuse','Supported by tests'],['Limit central face storage','Supported by design'],['Proven face performance','Not established']];
for(let i=0;i<4;i++){
 const y=140+i*185;text(results[i][0],440,y,690,38);
 arrow([[835,y+25],[955,y+25]]);
 text(results[i][1],1230,y,550,38,i===3?R:C);
 if(i<3)line([[130,y+115],[1470,y+115]],true);
}
finish();

start(16);
const risks=[['Cancelled\nwhile offline','Reconnect\nand refresh'],['Photo or screen\nshows a face','Test fake-face\nattacks'],['Cannot use\na face check','Test another\nentry route']];
for(let i=0;i<3;i++){
 const x=300+i*500;text(risks[i][0],x,185,440,42);
 arrow([[x,365],[x,475]]);
 box(risks[i][1],x-205,535,410,190,42);
}
text('Needed before a real event',800,765,1350,32,R);
finish();

start(17);
text('Next time',800,120,1000,46);
box('Build\nfeatures',130,305,360,190,46);
box('Freeze\nfeatures',620,305,360,190,46);
box('Run trials\nSave results',1110,305,360,190,44);
arrow([[530,400],[580,400]]);arrow([[1020,400],[1070,400]]);
line([[800,565],[800,625]]);
text('Set match rules first. Then test on new faces.',800,695,1400,40);
finish();

start(18);
box('Prepared\nprototype',140,230,500,225,52,'ellipse');
box('Ready for\npublic events?',960,230,500,225,48,'ellipse',true);
arrow([[690,340],[760,340]],true);arrow([[840,340],[910,340]],true);
line([[800,250],[800,445]]);text('More proof needed',800,140,900,38,R);
text('Ticket + face + offline gate\nCan work together',390,530,650,38);
text('Accuracy at scale?\nResistance to fake faces?',1210,530,650,38);
text('A working prototype is not a finished product',800,760,1400,40);
finish();

start(19);
box('Questions?',580,345,440,200,54,'ellipse');
text('Why one face\nand one ticket?',350,145,570,44);
text('What supports\noffline entry?',1250,145,570,44);
text('What needs testing\nbefore real events?',800,710,1000,44);
line([[480,300],[600,365]]);line([[1120,300],[1000,365]]);
line([[800,585],[800,665]]);
finish();

const html=`<html><head><style>@font-face{font-family:Virgil;src:url('https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/fonts/Virgil/Virgil-Regular.woff2')}</style></head><body><script type="module">import {convertToExcalidrawElements,exportToSvg,restoreElements} from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?bundle';await document.fonts.load('48px Virgil');window.ex={convertToExcalidrawElements,exportToSvg,restoreElements};</script></body></html>`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:'/Users/manavcodaty/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1600,height:900}});
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.waitForFunction(()=>window.ex,{timeout:90000});
elements=await page.evaluate(async(elements)=>{
 const textInput=elements.filter(e=>e.type==='text');
 const measured=window.ex.convertToExcalidrawElements(textInput);
 const map=new Map(measured.map(e=>[e.id,e]));
 // The converter may replace ids, so match by input order as a fallback.
 let index=0;
 return elements.map(e=>{
   if(e.type!=='text')return e;
   const m=map.get(e.id)||measured[index];index++;
   const slot=e.customData.slot;
   return {...e,width:m.width,height:m.height,x:slot.cx-m.width/2,y:slot.y,autoResize:true,originalText:e.text,lineHeight:1.25,baseline:m.baseline,strokeColor:e.strokeColor};
 });
},elements);
// Repair colour assignment on text after measurement.
for(const e of elements.filter(e=>e.type==='text')){
 const redTexts=['Same code','My assumption was wrong','I cannot borrow an accuracy claim','The missing beginning','No reusable\nface record here','Risk','Updates wait','Reject:\nalready used','Detailed receipt missing','Not established','Needed before real use','Stop adding','Promising prototype. Public readiness unproven.'];
 if(redTexts.includes(e.text))e.strokeColor=R;
 if(e.width>e.customData.slot.max)console.error(`Text too wide: ${e.text} (${e.width}/${e.customData.slot.max})`);
}
assert(elements.filter(e=>e.type==='text').every(e=>e.width<=e.customData.slot.max),'Fix all width failures');
const scene={type:'excalidraw',version:2,source:'https://excalidraw.com',elements,appState:{viewBackgroundColor:BG,theme:'light',gridSize:null},files:{}};
const master=`${OUT}/Private Pass - Diagram Edition.excalidraw`;
await fs.writeFile(master,JSON.stringify(scene,null,2)+'\n');
for(let i=1;i<=19;i++){
 const frame=elements.find(e=>e.id===`story-frame-${i}`),children=elements.filter(e=>e.frameId===frame.id);
 const svg=await page.evaluate(async({frame,children})=>{
  const els=window.ex.restoreElements([frame,...children],null);
  const svg=await window.ex.exportToSvg({elements:els,files:{},exportingFrame:els[0],exportPadding:0,appState:{exportBackground:true,viewBackgroundColor:'#fffdf8',exportWithDarkMode:false}});
  return new XMLSerializer().serializeToString(svg);
 },{frame,children});
 assert(!svg.includes('foreignObject'));
 const stem=`slide-${String(i).padStart(2,'0')}`;
 await fs.writeFile(`${OUT}/svg/${stem}.svg`,svg);
 await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${BUILD}/previews/${stem}.png`});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.ex);
}
await browser.close();server.close();
const words=slides.reduce((sum,s)=>sum+s.spoken.split(/\s+/).length,0);
assert.equal(words,1655);assert.equal(slides.length,19);
await fs.writeFile(`${OUT}/Speaker notes.md`,slides.map((s,i)=>`## ${i+1}. ${s.title}\n\nSpoken notes\n\n${s.spoken}\n\nKey points\n\n${s.keyPoints}\n`).join('\n'));
await fs.writeFile(`${BUILD}/manifest.json`,JSON.stringify({master,frames:19,spokenWords:words,slides:slides.map((s,i)=>({slide:i+1,...s}))},null,2));
console.log({master,frames:19,spokenWords:words,elements:elements.length});
