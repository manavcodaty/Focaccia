import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const source = '/Users/manavcodaty/Downloads/FINAL PRESENTATION.excalidraw';
const output = '/Users/manavcodaty/repos/Focaccia/output/final-presentation';
const scene = JSON.parse(await fs.readFile(source, 'utf8'));
const frames = scene.elements.filter(e => e.type === 'frame' && !e.isDeleted)
  .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}));
assert.equal(frames.length, 17);
await fs.mkdir(`${output}/svg`, {recursive:true});
await fs.mkdir(`${output}/../.final-presentation-previews`, {recursive:true});
const html = `<!doctype html><html><body><script type="module">
import {exportToSvg, exportToBlob, restoreElements} from 'https://esm.sh/@excalidraw/excalidraw@0.18.0?bundle';
window.excalidrawExport = {exportToSvg, exportToBlob, restoreElements};
</script></body></html>`;
const server = http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html'); res.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true, executablePath:'/Users/manavcodaty/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page = await browser.newPage({viewport:{width:1600,height:900}});
page.on('pageerror',e=>console.error('PAGE', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.waitForFunction(()=>window.excalidrawExport, {timeout:90000});
for (let i=0;i<frames.length;i++) {
  const frame=frames[i];
  const children=scene.elements.filter(e=>e.frameId===frame.id&&!e.isDeleted);
  assert(children.length>0, `Empty ${frame.name}`);
  const svg = await page.evaluate(async({frame,children,files})=>{
    const {exportToSvg,restoreElements}=window.excalidrawExport;
    const els=restoreElements([frame,...children],null);
    const svg=await exportToSvg({elements:els,files,
      appState:{exportBackground:true,viewBackgroundColor:'#fffdf8',exportWithDarkMode:false},
      exportingFrame:els[0], exportPadding:0, embedScene:false,
    });
    return new XMLSerializer().serializeToString(svg);
  },{frame,children,files:scene.files||{}});
  assert(!svg.includes('foreignObject'));
  const stem=`slide-${String(i+1).padStart(2,'0')}`;
  await fs.writeFile(`${output}/svg/${stem}.svg`,svg);
  console.log(stem,svg.length);
}
await browser.close(); server.close();
await fs.writeFile(`${output}/../../.codex-tmp/final-presentation-export/frames.json`,JSON.stringify(frames,null,2));
