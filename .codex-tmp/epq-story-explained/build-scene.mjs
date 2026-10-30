import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {slides,qa,N} from './content.mjs';

const ROOT='/Users/manavcodaty/repos/Focaccia';
const OUT=`${ROOT}/output/epq-story-explained`;
const BUILD=`${ROOT}/.codex-tmp/epq-story-explained`;
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

// 2: unlike a password, a face has no replacement after a leak.
start(2);
box('Leaked\npassword',130,160,410,180,46);
arrow([[590,250],[940,250]]);text('change it',765,170,330,36);
box('New\npassword',990,160,470,180,46);
face(335,435,65);text('Your face',335,595,440,40);
arrow([[465,500],[930,500]],true);
text('No replacement face',1200,475,580,42,R);
text('Can we check the person\nwhile keeping less face data?',800,690,1300,46);
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

// 5: show why a numerical face record can still expose its owner.
start(5);
face(250,180,75);text('Face',250,365,340,42);
box('Face\nnumbers',590,170,420,190,46);
face(1350,180,75);text('Face revealed?',1350,365,340,38);
arrow([[375,255],[540,255]]);arrow([[1060,255],[1225,255]],true);
text('Possible for some records',1165,120,630,30);
text('Numbers are not automatically anonymous',800,475,1380,40,R);
arrow([[800,565],[800,610],[430,610],[430,650]]);
arrow([[800,610],[1170,610],[1170,650]]);
text('Process on\nthe phones',430,695,650,44);
text('Protect separately\nfor each event',1170,695,650,44);
finish();

// 6: source evaluation makes the transfer limit explicit.
start(6);
box('Published study\nTheir equipment\nTheir participants',130,160,590,285,44);
box('Focaccia\nMy phone\nMy participants?',880,160,590,285,44);
line([[800,120],[800,550]],true);
text('Guides my design',425,525,650,42);
text('Needs its own trials',1175,525,650,42);
text('Their accuracy result',440,710,650,42);
text('My accuracy result',1170,710,650,42);
line([[770,728],[830,728]]);line([[770,750],[830,750]]);line([[785,772],[815,700]]);
finish();

// 7: planning and the feedback loop, without fabricated dates.
start(7);
const labels=['Research\nthe risks','Create\nan event','Make\na pass','Check it\nat the gate','Record\nthe results'];
const centres=[185,490,795,1100,1405];
for(let i=0;i<5;i++){
 text(labels[i],centres[i],245,280,40);
 add('ellipse',centres[i]-25,425,50,50,{roughness:1});
 if(i<4)arrow([[centres[i]+55,450],[centres[i+1]-55,450]]);
}
arrow([[1100,525],[1100,635],[490,635],[490,525]],true);
text('Gate check fails? Go back and fix the cause.',800,710,1350,40);
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
text('Your phone',315,120,430,46);text('Event service',800,120,430,46);text('Gate phone',1285,120,430,46);
text('Locks face record',315,225,440,36);text('Checks ticket',800,225,440,36);text('Opens it locally',1285,225,440,36);
envelope('Locked\nface record',130,335);
envelope('Still\nlocked',615,335);
box('Face record\n+ new face scan\nCompare here',1100,335,370,240,36);
arrow([[530,455],[585,455]]);arrow([[1015,455],[1070,455]]);
text('Stamp outside',800,615,430,38);
text('Cannot read inside',800,700,570,36,R);
text('Matching happens\non the gate phone',1285,680,470,38);
finish();

// 10: a concrete lost confirmation, followed by the same request and ticket.
start(10);
text('Phone',310,100,440,46);text('Event service',1250,100,520,46);
box('First tap\nRequest A',120,220,380,170,44);
arrow([[550,305],[1040,305]]);text('Create ticket',790,225,450,36);
box('Ticket 42\ncreated',1090,220,390,170,44);
line([[1090,470],[860,470]],true);arrow([[740,470],[500,470]],true);
line([[780,445],[820,495]]);line([[820,445],[780,495]]);
text('Confirmation lost',800,515,700,38,R);
box('Tap again\nSame request A',120,625,440,170,42);
arrow([[610,710],[1000,710]]);text('Recognise retry',805,635,440,34);
box('Return the same\nTicket 42',1050,625,430,170,42);
finish();

// 11: two consequences, not a network schematic.
start(11);
text('Gate is offline',410,125,650,48);
text('Pass + fresh face scan',410,260,650,38);
arrow([[410,345],[410,425]]);
box('Checks on phone\nEntry can continue',120,470,580,225,44,'ellipse');
line([[800,140],[800,770]],true);
box('New ticket\ncancellation',940,175,530,185,44);
arrow([[1205,400],[1205,465]],true);
line([[1015,505],[1395,505]]);
text('No connection',1205,555,550,40,R);
text('Update reaches the gate\nonly after reconnection',1205,690,650,38);
finish();

// 12: one compact, explicitly labelled demonstration plan.
start(12);
text('Planned demo: Wi-Fi off, one prepared gate',800,105,1400,42);
box('First scan\nPass 42',130,235,370,180,44);
box('Unused\nAccept',665,235,370,180,44);
arrow([[550,325],[615,325]]);arrow([[1085,325],[1160,325]]);
text('Remember 42\nas used',1315,275,370,40);
box('Scan again\nSame pass 42',130,600,370,180,42);
box('Already used\nReject',665,600,370,180,42);
arrow([[550,690],[615,690]]);arrow([[1085,690],[1160,690]]);
text('No second\nentry',1315,635,370,42);
text('Same gate remembers',800,475,900,36);
finish();

// 13: distinguish traceable records from self-reported observation.
start(13);
box('Earlier software tests\nSteps + results\nDated log exists',130,175,610,300,44);
box('Final journey\nReported success',860,175,610,300,44,'ellipse');
text('Someone can inspect\nthe earlier records',435,540,650,40);
text('Detailed final log missing',1165,550,650,34,R);
text('One successful run cannot establish reliability',800,740,1380,40);
finish();

// 14: direct evaluation of aims, with no invented evidence score.
start(14);
const aimRows=[['Did the steps connect?','Reported working'],['Less face data on server?','Supported by design'],['Reliable for real crowds?','Not established']];
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
face(330,330,85);text('Attendee',330,545,440,44);
box('Yes\nFace check',1000,145,460,200,46);
box('No\nAnother entry route',960,555,520,200,42);
arrow([[480,370],[915,245]]);arrow([[480,465],[905,655]]);
text('“Do I want to use my face?”',630,110,1080,44);
text('A real alternative\nis needed before public use',573.333333,655,650,34,R);
finish();

// 16: why the schedule slipped and the decision to change next time.
start(16);
box('Ticket claiming\nadded',130,160,360,170,40);box('More faults\nto trace',620,160,360,170,42);box('Less time\nfor trials',1110,160,360,170,42);
arrow([[520,245],[590,245]]);arrow([[1010,245],[1080,245]]);
line([[140,440],[1460,440]],true);
text('Next time',310,510,450,40);
text('Build',330,680,330,46);text('Freeze features',800,680,600,44);text('Repeat tests\nKeep results',1250,680,590,40);
arrow([[180,620],[1430,620]]);line([[800,575],[800,650]]);
text('Stop adding',800,490,420,34,R);
finish();

// 17: retain a defensible conclusion throughout the Q&A.
start(17);
box('Connected\nprototype',140,230,500,225,50,'ellipse');
box('Ready for\npublic events?',960,230,500,225,48,'ellipse',true);
arrow([[690,340],[760,340]],true);arrow([[840,340],[910,340]],true);
line([[800,250],[800,445]]);text('Evidence gap',800,145,650,38,R);
text('Local face checks\nLess central face storage',390,530,650,40);
text('Needs repeated trials\nand real user feedback',1210,530,650,40);
text('Building it does not prove it is ready.',800,750,1350,44);
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
const master=`${OUT}/Focaccia - Explained Story.excalidraw`;
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
