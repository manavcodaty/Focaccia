import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='/Users/manavcodaty/repos/Focaccia';
const output=`${base}/output/epq-story-redesign`;
const privateDir=`${base}/.codex-tmp/epq-story-redesign`;
await fs.mkdir(`${privateDir}/previews`,{recursive:true});
await fs.mkdir(`${privateDir}/original-svg`,{recursive:true});
const html=`<!doctype html><html><head><style>body{margin:0}svg{display:block}</style></head><body><script type="module">
import * as fontkit from 'https://esm.sh/fontkit@2.0.4?bundle';
import {Buffer} from 'https://esm.sh/buffer@6.0.3?bundle';
window.fontkit=fontkit;window.Buffer=Buffer;
</script></body></html>`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'/Users/manavcodaty/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
page.on('pageerror',e=>console.error(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.waitForFunction(()=>window.fontkit&&window.Buffer,{timeout:90000});
await page.evaluate((fontBytes)=>{
  window.symbolFont=window.fontkit.create(window.Buffer.from(fontBytes,'base64'));
},(await fs.readFile('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')).toString('base64'));
for(let n=1;n<=17;n++){
  const stem=`slide-${String(n).padStart(2,'0')}`;
  const svg=await fs.readFile(`${output}/svg/${stem}.svg`,'utf8');
  await fs.writeFile(`${privateDir}/original-svg/${stem}.svg`,svg);
  const result=await page.evaluate(async(svg)=>{
    document.querySelectorAll('body>svg').forEach(e=>e.remove());
    document.body.insertAdjacentHTML('beforeend',svg);
    await document.fonts.ready;
    const root=document.querySelector('body>svg');
    const fonts=[];
    for(const sheet of [...document.styleSheets]){
      for(const rule of [...sheet.cssRules]){
        if(rule.type!==CSSRule.FONT_FACE_RULE)continue;
        const src=rule.style.getPropertyValue('src');
        const match=src.match(/base64,([^\s"')]+)/);
        if(match)fonts.push({family:rule.style.getPropertyValue('font-family').replaceAll('"','').replaceAll("'",'').trim(),font:window.fontkit.create(window.Buffer.from(match[1],'base64'))});
      }
    }
    let replaced=0;
    for(const text of [...root.querySelectorAll('text')]){
      const family=text.getAttribute('font-family').split(',')[0].trim().replaceAll('"','').replaceAll("'",'');
      let font=fonts.find(f=>f.family===family)?.font;
      if(!font)throw new Error('Missing font '+family);
      const content=text.textContent;
      if([...content].some(char=>!font.hasGlyphForCodePoint(char.codePointAt(0)))) {
        if(![...content].every(char=>window.symbolFont.hasGlyphForCodePoint(char.codePointAt(0))))throw new Error('Unrenderable glyph '+content);
        font=window.symbolFont;
      }
      const size=parseFloat(text.getAttribute('font-size'));
      const scale=size/font.unitsPerEm;
      const layout=font.layout(content);
      let x=Number(text.getAttribute('x')||0),y=Number(text.getAttribute('y')||0);
      const width=layout.positions.reduce((s,p)=>s+p.xAdvance,0)*scale;
      const anchor=text.getAttribute('text-anchor');
      if(anchor==='middle')x-=width/2;else if(anchor==='end')x-=width;
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');
      for(const attr of text.attributes)if(!['x','y','font-family','font-size','text-anchor','style'].includes(attr.name))g.setAttribute(attr.name,attr.value);
      g.setAttribute('aria-label',content);
      for(let i=0;i<layout.glyphs.length;i++){
        const glyph=layout.glyphs[i],pos=layout.positions[i];
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',glyph.path.toSVG());
        path.setAttribute('transform',`translate(${x+pos.xOffset*scale} ${y-pos.yOffset*scale}) scale(${scale} ${-scale})`);
        g.append(path);x+=pos.xAdvance*scale;y-=pos.yAdvance*scale;
      }
      text.replaceWith(g);replaced++;
    }
    root.querySelectorAll('style.style-fonts').forEach(e=>e.remove());
    return {svg:new XMLSerializer().serializeToString(root),replaced};
  },svg);
  assert(result.replaced>0);
  assert(!result.svg.includes('<text'));
  await fs.writeFile(`${output}/svg/${stem}.svg`,result.svg);
  await page.screenshot({path:`${privateDir}/previews/${stem}.png`});
  console.log(stem,'outlined labels',result.replaced);
}
await browser.close();server.close();
