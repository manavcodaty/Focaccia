import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='/Users/manavcodaty/repos/Focaccia';
const scene=JSON.parse(await fs.readFile(`${base}/output/epq-story-explained/Focaccia - Explained Story.excalidraw`,'utf8'));
const frames=scene.elements.filter(e=>e.type==='frame'&&!e.isDeleted);
const failures=[];
const contained=(a,b,pad=0)=>b.x>=a.x+pad&&b.y>=a.y+pad&&b.x+b.width<=a.x+a.width-pad&&b.y+b.height<=a.y+a.height-pad;
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function segmentBox(a,b,r){
 let low=0,high=1;const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const [p,q] of [[-dx,a[0]-r.x],[dx,r.x+r.width-a[0]],[-dy,a[1]-r.y],[dy,r.y+r.height-a[1]]]){
  if(p===0){if(q<0)return false;continue;}
  const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return false;
 }
 return true;
}
for(const [idx,f] of frames.entries()){
 const els=scene.elements.filter(e=>e.frameId===f.id&&!e.isDeleted&&!e.customData?.background);
 const texts=els.filter(e=>e.type==='text'),shapes=els.filter(e=>['rectangle','ellipse','diamond'].includes(e.type)),lines=els.filter(e=>['arrow','line'].includes(e.type));
 for(const e of els){
  let b=e;if(e.points){const xs=e.points.map(p=>e.x+p[0]),ys=e.points.map(p=>e.y+p[1]);b={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
  if(!contained(f,b,80))failures.push({slide:idx+1,kind:'outer margin',text:e.text,id:e.id});
 }
 for(const t of texts){
  const owner=shapes.find(e=>e.id===t.customData?.owner);
  if(owner&&!contained(owner,t,24))failures.push({slide:idx+1,kind:'internal padding',text:t.text});
  for(const s of shapes){if(s.id===owner?.id)continue;if(overlap(t,s))failures.push({slide:idx+1,kind:'text/shape',text:t.text});}
  for(const l of lines){if(l.customData?.intentionalIcon&&l.customData.owner===owner?.id)continue;
   for(let i=1;i<l.points.length;i++){
    const a=[l.x+l.points[i-1][0],l.y+l.points[i-1][1]],b=[l.x+l.points[i][0],l.y+l.points[i][1]];
    const r={x:t.x-5,y:t.y-5,width:t.width+10,height:t.height+10};
    if(segmentBox(a,b,r))failures.push({slide:idx+1,kind:'connector/text',text:t.text});
   }
  }
 }
 for(let i=0;i<shapes.length;i++)for(let k=i+1;k<shapes.length;k++)if(overlap(shapes[i],shapes[k]))failures.push({slide:idx+1,kind:'shape/shape',ids:[shapes[i].id,shapes[k].id]});
 for(let i=0;i<texts.length;i++)for(let k=i+1;k<texts.length;k++)if(overlap(texts[i],texts[k]))failures.push({slide:idx+1,kind:'text/text',text:[texts[i].text,texts[k].text]});
}
const unique=[...new Map(failures.map(e=>[JSON.stringify(e),e])).values()];
console.log(JSON.stringify({frames:frames.length,failures:unique},null,2));
await fs.writeFile(`${base}/.codex-tmp/epq-story-explained/preflight.json`,JSON.stringify({frames:frames.length,failures:unique},null,2));
assert.equal(frames.length,17);assert.equal(unique.length,0,'Fix all flagged spacing before release');
