import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {slides,qa,N} from './content.mjs';

const ROOT='/Users/manavcodaty/repos/Focaccia';
const OUT=`${ROOT}/output/privatepass-faithful-diagrams`;
const BUILD=`${ROOT}/.codex-tmp/privatepass-faithful-diagrams`;
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
box('Register',130,285,350,190,48);
face(800,285,75);text('Get pass',800,485,450,42);
box('Verify\nlocally',1100,285,370,190,46);
arrow([[530,380],[665,380]]);arrow([[925,380],[1050,380]]);
text('One ticket. One person.',800,590,1250,48);
text('Entry checks that work offline,\nwithout a central face database.',800,710,1400,40);
finish();

start(2);
box('QR ticket',130,175,470,180,48);
arrow([[365,395],[365,465]]);
text('Can be shared',365,520,610,42);
box('Central face\ndatabase',1000,175,470,180,44);
arrow([[1235,395],[1235,465]]);
text('Stores lasting data',1235,520,610,42);
text('Private Pass: links ticket + person',800,665,1400,44);
text('Check the holder without a central face database.',800,770,1400,34);
finish();

start(3);
text('1:1 match\nTicket + registered face',330,160,600,40);
text('Offline\nGate decides without internet',1220,160,620,40);
box('Success needs\nall four',580,390,440,180,46,'ellipse');
text('Privacy\nNo central reusable face records',410,685,660,38);
text('Evidence\nSave tests and limits',1250,685,560,42);
line([[475,305],[605,365]]);line([[1125,305],[995,365]]);
line([[475,650],[605,595]]);line([[1125,650],[995,595]]);
finish();

start(4);
const stageX=[310,800,1290];
const stageLabels=['Build the base','Connect the parts','Fix and improve'];
const stageDetail=['Camera\nLocal network\nPrivacy design','Tickets\nOffline checks\nSyncing','Login\nNetworking\nApp screens'];
for(let i=0;i<3;i++){
 text(stageLabels[i],stageX[i],205,460,40);
 box(stageDetail[i],stageX[i]-190,310,380,250,36);
 if(i<2)arrow([[stageX[i]+215,435],[stageX[i+1]-215,435]]);
}
text('Supervisor: how does someone get a ticket?',800,100,1380,38);
text('Adding ticketing made the journey complete',800,650,1380,40);
text('More features left less time for testing',800,755,1380,38,R);
finish();

start(5);
const researchRows=[
 ['Schroff et al. (2015)','Faces can be compared\nas numerical data.','Use a trained model\nfor a 1:1 check.'],
 ['Mai et al. (2019)\nRathgeb & Uhl (2011)','A face template can\nstill reveal information.','Use event-specific\ndata. Avoid claiming\nanonymity.'],
 ['Josefsson &\nLiusvaara (2017)','Signatures show if\na pass was changed.','Let the gate check\npasses offline.']
];
for(let i=0;i<3;i++){
 const y=145+i*215;text(researchRows[i][0],320,y,460,30);
 text(researchRows[i][1],810,y,480,34);
 arrow([[1060,y+42],[1130,y+42]]);
 text(researchRows[i][2],1330,y,340,30);
}
text('Published results guided decisions; they were not Private Pass test results.',800,785,1440,28,R);
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
box('One person\nOne ticket',580,450,440,180,46,'ellipse');
text('Event A ≠ Event B',800,665,1200,42);
text('The same face is represented differently for each event.',800,730,1400,30);
text('Not proven: unlinkability',800,785,1200,28,R);
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
text('Event data downloaded before the event',800,105,1380,42);
text('Correct event and time\nValid digital signature\nNot cancelled or already used\nFace matches the ticket',440,300,700,38);
arrow([[850,425],[995,425]]);
box('First valid scan\nAccept',1040,320,440,215,42,'ellipse');
text('Second scan: reject',800,650,1350,44);
text('New cancellations wait for reconnection',800,755,1350,38,R);
finish();

start(11);
const fixes=[
 ['Camera cropping\nDifferent face inputs','Use the same crop rules\nin both apps.'],
 ['Repeated claims\nLost response','Reuse the same request ID\non retry.'],
 ['Record before success\nApp could stop before saving','Save the used ticket\nbefore showing success.']
];
for(let i=0;i<3;i++){
 const y=150+i*245;text(fixes[i][0],440,y,680,37);
 arrow([[840,y+45],[960,y+45]]);
 text(fixes[i][1],1240,y,550,36);
 if(i<2)line([[130,y+145],[1470,y+145]],true);
}
finish();

start(12);
text('Saved checks\n15 June',430,115,650,46);
text('Not established\non the final version',1190,115,650,44);
line([[800,130],[800,685]],true);
text('Ticket claims, ownership, capacity, access\nRetries without unwanted duplicates\nPass authenticity + reused-ticket rejection\nSigned sync + cancellation refresh\niPhone launch + local Wi-Fi',430,300,700,32);
text('Full phone journey: no final receipt\nAccuracy: no genuine / impostor trials\nSpoofing: no photo, screen or mask trials\nReal use: no queue timings or user study',1190,300,670,30);
text('Bugs fixed: crop rules, safe retries, save before success',800,705,1400,34);
text('Software checks do not prove the full physical journey',800,775,1400,34,R);
finish();

start(13);
const evidence=[
 ['Recorded','Automated, browser, simulator,\nlocal-network checks. iPhone launch.'],
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
const results=[
 ['Offline gate decisions','Partial','Software checks supported;\nfull phone route later observed.'],
 ['Stop ticket reuse','Supported','Repeated-use handling\nbacked by tests.'],
 ['Limit central face storage','By design','Architecture avoids reusable\ncentral face records.'],
 ['Proven face performance','Not proven','No full accuracy, spoof\nor fairness dataset.']
];
for(let i=0;i<4;i++){
 const y=110+i*185;text(results[i][0],440,y,690,38);
 text(results[i][2],440,y+60,690,28);
 arrow([[835,y+25],[955,y+25]]);
 text(results[i][1],1230,y+25,550,44,i===3?R:C);
 if(i<3)line([[130,y+155],[1470,y+155]],true);
}
finish();

start(16);
const risks=[['Cancelled tickets\nOld cancellation list','Shorter validity\nand refresh rules'],['Fake faces\nFace detected does not\nmean real person','Run photo, screen\nand mask tests'],['Usability\nNo retained user\nor fallback study','Test accessibility\nand manual entry']];
for(let i=0;i<3;i++){
 const x=300+i*500;text(risks[i][0],x,185,440,36);
 arrow([[x,365],[x,475]]);
 box(risks[i][1],x-205,535,410,190,36);
}
text('Needed before a real event',800,765,1350,32,R);
finish();

start(17);
text('Stop adding features sooner',800,120,1400,42,R);
const lessonX=[300,800,1300];
const lessonTop=['Build','Freeze features','Evaluate'];
const lessonBottom=['Save device details,\nsteps, logs and outcomes.','Set thresholds first','Test on\nfresh examples'];
for(let i=0;i<3;i++){
 text(lessonTop[i],lessonX[i],300,460,44);
 add('ellipse',lessonX[i]-25,435,50,50);
 if(i<2)arrow([[lessonX[i]+60,460],[lessonX[i+1]-60,460]]);
 text(lessonBottom[i],i===0?340:lessonX[i],625,470,35);
}
finish();

start(18);
box('Working\nprototype',140,230,500,225,52,'ellipse');
box('Ready for\npublic events?',960,230,500,225,48,'ellipse',true);
arrow([[690,340],[760,340]],true);arrow([[840,340],[910,340]],true);
line([[800,250],[800,445]]);text('More proof needed',800,140,900,38,R);
text('What I can show:\nThe ticket, face check\nand offline gate can work together.',390,530,650,32);
text('What I cannot claim:\nAccuracy at scale,\nstrong anti-spoofing,\nreadiness for public events.',1210,515,650,32);
text('Private Pass shows this approach is possible in a prepared setup.',800,710,1400,32);
text('Real tests are still needed before live deployment',800,785,1400,28,R);
finish();

start(19);
box('Questions?',580,345,440,200,54,'ellipse');
text('Why compare one face\nwith one ticket?',350,145,570,40);
text('What tests support\nthe offline checks?',1250,145,570,40);
text('What would I test\nbefore a real event?',800,710,1000,44);
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
const master=`${OUT}/Private Pass - Faithful Diagrams.excalidraw`;
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
