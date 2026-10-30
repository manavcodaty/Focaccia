import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from 'playwright';
const base='/Users/manavcodaty/repos/Focaccia/.codex-tmp/privatepass-faithful-diagrams';
const browser=await chromium.launch({headless:true,executablePath:'/Users/manavcodaty/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const reports=[];
for(let n=1;n<=19;n++){
  const stem=`slide-${String(n).padStart(2,'0')}`;
  const original=await fs.readFile(`${base}/original-svg/${stem}.svg`,'utf8');
  await page.setContent('<html><body style="margin:0">'+original+'</body></html>');
  await page.evaluate(()=>document.fonts.ready);
  const originalPng=await page.screenshot();
  await fs.writeFile(`${base}/previews/${stem}-original.png`,originalPng);
  const a=await sharp(originalPng).removeAlpha().raw().toBuffer();
  const b=await sharp(`${base}/previews/${stem}.png`).removeAlpha().raw().toBuffer();
  const c=await sharp(`${base}/native-final/${stem}.png`).removeAlpha().raw().toBuffer();
  assert.equal(a.length,b.length);assert.equal(b.length,c.length);
  let outlineChanged=0,nativeChanged=0,nativeError=0;
  for(let i=0;i<a.length;i+=3){
    const da=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
    const db=Math.max(Math.abs(b[i]-c[i]),Math.abs(b[i+1]-c[i+1]),Math.abs(b[i+2]-c[i+2]));
    if(da>64)outlineChanged++;
    if(db>64)nativeChanged++;
    nativeError+=(Math.abs(b[i]-c[i])+Math.abs(b[i+1]-c[i+1])+Math.abs(b[i+2]-c[i+2]))/3;
  }
  const report={slide:n,outlineChangedPercent:100*outlineChanged/(1600*900),nativeChangedPercent:100*nativeChanged/(1600*900),nativeMeanError:nativeError/(1600*900)};
  reports.push(report);console.log(report);
  assert(report.nativeChangedPercent<3,`Native rendering mismatch on slide ${n}`);
}
await browser.close();
await fs.writeFile(`${base}/render-comparison.json`,JSON.stringify(reports,null,2));
const tiles=[];
for(let n=1;n<=19;n++){
 const stem=`slide-${String(n).padStart(2,'0')}`;
 tiles.push({input:await sharp(`${base}/native-final/${stem}.png`).resize(400,225).png().toBuffer(),left:((n-1)%4)*420+10,top:Math.floor((n-1)/4)*245+10});
}
await sharp({create:{width:1680,height:1225,channels:3,background:'#ddd'}}).composite(tiles).png().toFile('/Users/manavcodaty/repos/Focaccia/output/privatepass-faithful-diagrams/Preview.png');
