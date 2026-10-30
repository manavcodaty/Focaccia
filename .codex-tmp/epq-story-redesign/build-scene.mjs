import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {slides,qa,N} from './content.mjs';

const ROOT='/Users/manavcodaty/repos/Focaccia';
const OUT=`${ROOT}/output/epq-story-redesign`;
const BUILD=`${ROOT}/.codex-tmp/epq-story-redesign`;
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
function start(slide){n=slide;serial=0;offsetX=((n-1)%4)*1800;offsetY=Math.floor((n-1)/4)*1050;local=[];
 elements.push({id:`story-frame-${n}`,type:'frame',x:offsetX,y:offsetY,width:1600,height:900,name:`Slide ${String(n).padStart(2,'0')}`,angle:0,strokeColor:C,backgroundColor:'transparent',fillStyle:'solid',strokeWidth:1,strokeStyle:'solid',roughness:0,opacity:100,groupIds:[],frameId:null,isDeleted:false,locked:false,seed:100+n,version:1,versionNonce:100+n,customData:{...slides[n-1],qa:n===17?qa:undefined}});
 add('rectangle',0,0,1600,900,{strokeColor:BG,backgroundColor:BG,roughness:0,strokeWidth:0,customData:{background:true}});
}
function finish(){elements.push(...local);}

// 1: copying the ticket changes the holder, not the code.
start(1);
text('Focaccia',800,95,700,58);
box('Ticket 42',180,265,410,180,52);box('Ticket 42',1010,265,410,180,52);
arrow([[640,355],[960,355]]);text('copy',800,275,220,40);
text('Owner',385,485,400,42);text('Someone else',1215,485,500,42);
text('Same code',800,420,340,36,R);
text('A valid ticket.\nBut who is holding it?',800,665,1150,48);
finish();

// 2: motivation converges on a clear question.
start(2);
box('I enjoy building\nuseful things',145,175,535,210,46,'ellipse');
box('You cannot replace\nyour face',920,175,535,210,46,'ellipse');
arrow([[420,425],[605,535]]);arrow([[1180,425],[995,535]]);
box('Can we check the person\nwhile keeping less face data?',310,575,980,205,48);
finish();

// 3: scope is a ladder rather than an invented numerical chart.
start(3);
text('Too broad',270,175,310,40);text('A commercial event platform',1000,175,900,44);
line([[160,315],[1440,315]],true);
text('My scope',270,425,310,44);box('One event.\nOne prepared gate.',560,370,840,190,48,'ellipse');
line([[160,620],[1440,620]],true);
text('Too small',270,705,310,40);text('A face scan on its own',1000,705,900,44);
finish();

// 4: three mutually dependent questions, like the successful reference slide.
start(4);
box('Can I\nbuild it?',600,100,400,200,48,'ellipse');
box('What makes\nit different?',155,575,440,210,46,'ellipse');
box('How will I\nprove it?',1005,575,440,210,46,'ellipse');
line([[650,295],[470,565]]);line([[950,295],[1130,565]]);line([[625,680],[975,680]]);
text('Feasibility',350,395,400,36);text('Originality',1240,395,400,36);text('Evidence',800,725,340,36);
finish();

// 5: an assumption is revised by research, then becomes two design decisions.
start(5);
box('A face becomes\nnumbers',150,160,490,185,46);box('Still personal\ninformation',960,160,490,185,46);
arrow([[690,250],[910,250]]);
text('My assumption was wrong',800,405,1050,40,R);
arrow([[1110,390],[1110,560]]);arrow([[800,505],[420,560]]);
box('Keep processing\non the phones',120,610,610,180,44);
box('Make the record\nspecific to one event',875,610,610,180,42);
finish();

// 6: source evaluation makes the transfer limit explicit.
start(6);
box('A study shows\nwhat is possible',130,180,550,240,48,'ellipse');
box('My build needs\nits own tests',920,180,550,240,48,'ellipse');
line([[735,300],[865,300]],true);
text('Different phones\nDifferent people\nDifferent conditions',800,490,950,42);
text('I cannot borrow an accuracy claim',800,740,1250,38,R);
finish();

// 7: planning and the feedback loop, without fabricated dates.
start(7);
const labels=['Research','Event\nsetup','Face\nstep','Gate\ncheck','Evaluate'];
const centres=[185,490,795,1100,1405];
for(let i=0;i<5;i++){
 text(labels[i],centres[i],245,280,40);
 add('ellipse',centres[i]-25,425,50,50,{roughness:1});
 if(i<4)arrow([[centres[i]+55,450],[centres[i+1]-55,450]]);
}
arrow([[1100,525],[1100,635],[490,635],[490,525]],true);
text('Fix, test, record',800,710,900,44);
finish();

// 8: the missing beginning becomes visible in a before/after comparison.
start(8);
text('My first version',320,105,550,40);
box('Register face',610,200,370,155,43);box('Enter',1110,200,340,155,44);
arrow([[1010,278],[1080,278]]);
line([[140,435],[1460,435]],true);
text('After feedback',320,475,550,40);
box('Claim ticket',140,580,360,155,44);box('Register face',610,580,370,155,43);box('Enter',1110,580,340,155,44);
arrow([[530,658],[580,658]]);arrow([[1010,658],[1080,658]]);
text('The missing beginning',320,770,530,34,R);
finish();

// 9: a familiar envelope analogy, the sole architecture slide.
start(9);
text('Your phone',330,145,430,44);text('Event service',800,145,430,44);text('Gate phone',1270,145,430,44);
const env=box('',150,325,350,200);line([[160,335],[325,420],[490,335]],false,{customData:{intentionalIcon:true,owner:env}});
text('Face record',325,445,285,36,C,env);
box('Check ticket\nSeal pass',615,320,370,215,44);
box('Open record\nCompare face',1080,320,370,215,42);
arrow([[530,425],[585,425]]);arrow([[1015,425],[1050,425]]);
text('Lock',325,590,350,42);text('No reusable\nface record here',800,590,470,36,R);text('Check locally',1265,590,470,42);
text('A sealed pass carries the protected record',800,765,1320,38);
finish();

// 10: failure and recovery, expressed through a familiar double-tap.
start(10);
text('If the reply is lost...',800,105,1250,44);
text('Risk',220,245,230,38,R);box('Tap again',420,215,330,145,44);arrow([[790,287],[1025,287]]);box('Another\nticket?',1070,205,360,165,44);
line([[140,455],[1460,455]],true);
text('My fix',220,590,230,38);box('Tap again',420,550,300,145,42);box('Recognise\nthe retry',840,550,300,145,38);box('Same\nticket',1240,550,250,145,38);
arrow([[750,623],[810,623]]);arrow([[1170,623],[1210,623]]);
text('A lost reply must not create a second ticket',800,775,1370,37);
finish();

// 11: two consequences, not a network schematic.
start(11);
text('No Wi-Fi',410,170,610,48);text('New cancellation',1190,170,660,46);
arrow([[410,300],[410,405]]);arrow([[1190,300],[1190,405]],true);
box('Gate can\nstill decide',120,450,580,190,46,'ellipse');
box('Must wait for\nreconnection',900,450,580,190,46,'ellipse');
text('Updates wait',1190,700,580,36,R);
text('Entry continues',410,700,580,40);
finish();

// 12: one compact, explicitly labelled demonstration plan.
start(12);
text('Expected demonstration',800,110,1200,42);
const demoX=[300,800,1300];
const demoTop=['Wi-Fi off','First scan','Same pass again'];
const demoBottom=['No live\nconnection','Accept\nonce','Reject:\nalready used'];
for(let i=0;i<3;i++){
 text(demoTop[i],demoX[i],270,430,42);
 const step=add('ellipse',demoX[i]-50,395,100,100);text(String(i+1),demoX[i],423,60,34,C,step);
 if(i<2)arrow([[demoX[i]+70,442],[demoX[i+1]-70,442]]);
 text(demoBottom[i],demoX[i],575,450,44,i===2?R:C);
}
text('One prepared gate',800,770,1000,36);
finish();

// 13: distinguish traceable records from self-reported observation.
start(13);
box('Earlier software checks\nRecords retained',130,175,610,245,44);
box('My complete journey\nReported successful',860,175,610,245,44);
text('Traceable, but dated',435,495,650,38);
text('Detailed receipt missing',1165,495,650,36,R);
text('One successful run',470,690,650,46);text('Reliable for everyone',1190,690,650,44);
line([[785,710],[875,710]]);line([[785,730],[875,730]]);line([[805,750],[850,680]]);
finish();

// 14: direct evaluation of aims, with no invented evidence score.
start(14);
const aimRows=[['Connected event journey','Reported working'],['Less central face storage','Supported by design'],['Fast, accurate, trusted?','Not established']];
for(let i=0;i<3;i++){
 const y=190+i*230;
 text(aimRows[i][0],440,y,680,42);
 arrow([[825,y+28],[940,y+28]]);
 text(aimRows[i][1],1220,y,550,42,i===2?R:C);
 if(i<2)line([[130,y+135],[1470,y+135]],true);
}
finish();

// 15: a real ethical choice, explicitly marked as future deployment work.
start(15);
box('A real\nattendee',125,340,400,200,48,'ellipse');
box('Choose\nface entry',1000,145,460,200,46);
box('Use another\nentry route',1000,555,460,200,46);
arrow([[565,410],[945,245]]);arrow([[565,470],[945,655]]);
text('Choice must be real',690,110,1150,42);
text('Needed before real use',690,765,1050,36,R);
finish();

// 16: why the schedule slipped and the decision to change next time.
start(16);
box('Ticket journey\nadded',130,160,360,170,42);box('More links\nto debug',620,160,360,170,42);box('Less time\nto evaluate',1110,160,360,170,42);
arrow([[520,245],[590,245]]);arrow([[1010,245],[1080,245]]);
line([[140,440],[1460,440]],true);
text('Next time',310,510,450,40);
text('Build',330,680,330,46);text('Freeze features',800,680,600,44);text('Protect testing time',1250,680,590,40);
arrow([[180,620],[1430,620]]);line([[800,575],[800,650]]);
text('Stop adding',800,490,420,34,R);
finish();

// 17: retain a defensible conclusion throughout the Q&A.
start(17);
box('Build it',155,230,450,215,56,'ellipse');box('Prove it',995,230,450,215,56,'ellipse');
arrow([[665,337],[935,337]],true);text('Next step',800,245,320,36);
text('Connected prototype\nLess central face storage',380,505,670,40);
text('Repeated trials\nUser feedback',1220,505,650,40);
text('Promising prototype. Public readiness unproven.',800,735,1430,40,R);
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
 assert(e.width<=e.customData.slot.max,`Text too wide: ${e.text} (${e.width}/${e.customData.slot.max})`);
}
const scene={type:'excalidraw',version:2,source:'https://excalidraw.com',elements,appState:{viewBackgroundColor:BG,theme:'light',gridSize:null},files:{}};
const master=`${OUT}/Focaccia - EPQ Story.excalidraw`;
await fs.writeFile(master,JSON.stringify(scene,null,2)+'\n');
for(let i=1;i<=17;i++){
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
assert(words>=1250&&words<=1400);assert.equal(slides.length,17);
await fs.writeFile(`${OUT}/Speaker notes.md`,slides.map((s,i)=>`## ${i+1}. ${s.title}\n\n${s.spoken}\n\n[Stage direction]\n${s.cue}\n\n[Evidence]\n${s.status}\n\n[Sources]\n${s.sources.join('\n')}\n`).join('\n')+'\n'+qa);
await fs.writeFile(`${BUILD}/manifest.json`,JSON.stringify({master,frames:17,spokenWords:words,slides:slides.map((s,i)=>({slide:i+1,...s}))},null,2));
console.log({master,frames:17,spokenWords:words,elements:elements.length});
