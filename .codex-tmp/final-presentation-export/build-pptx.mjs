import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
import {finalizePresentation} from '/Users/manavcodaty/.codex/plugins/cache/openai-primary-runtime/presentations/26.1015.12040/skills/presentations/container_tools/artifact_tool_utils.mjs';

const workspaceDir='/Users/manavcodaty/repos/Focaccia';
const output=path.join(workspaceDir,'output/final-presentation');
const build=path.join(workspaceDir,'.codex-tmp/final-presentation-export');
const skill='/Users/manavcodaty/.codex/plugins/cache/openai-primary-runtime/presentations/26.1015.12040/skills/presentations';
const p=Presentation.create({slideSize:{width:1600,height:900}});
for(let n=1;n<=17;n++){
  const stem=`slide-${String(n).padStart(2,'0')}`;
  const svg=await fs.readFile(path.join(output,'svg',stem+'.svg'),'utf8');
  assert(svg.includes('viewBox="0 0 1600 900"'));
  assert(!svg.includes('foreignObject'));
  const s=p.slides.add();
  s.background.fill='#fffdf8';
  s.images.add({svg,alt:`Final Excalidraw presentation, slide ${n}`,fit:'contain',position:{left:0,top:0,width:1600,height:900}});
}
const draft=path.join(build,'candidate.pptx');
await(await PresentationFile.exportPptx(p)).save(draft);
console.log('Draft exported',draft);
const result=await finalizePresentation({
  workspaceDir,candidatePath:draft,finalPath:path.join(output,'FINAL PRESENTATION.pptx'),
  explicitTotalSlideCount:17,
  pythonExecutable:'/Users/manavcodaty/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','15240000,8572500'],
  requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
  verifyArtifactToolImport:true,receiptPath:path.join(build,'validation-final.json'),
});
console.log(JSON.stringify(result));
