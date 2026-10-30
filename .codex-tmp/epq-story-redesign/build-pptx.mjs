import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
import {finalizePresentation} from '/Users/manavcodaty/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations/container_tools/artifact_tool_utils.mjs';
import {slides,qa} from './content.mjs';
const workspaceDir='/Users/manavcodaty/repos/Focaccia';
const output=path.join(workspaceDir,'output/epq-story-redesign');
const build=path.join(workspaceDir,'.codex-tmp/epq-story-redesign');
const skill='/Users/manavcodaty/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const p=Presentation.create({slideSize:{width:1600,height:900}});
for(const [i,content] of slides.entries()){
 const svg=await fs.readFile(path.join(output,'svg',`slide-${String(i+1).padStart(2,'0')}.svg`),'utf8');
 assert(svg.includes('viewBox="0 0 1600 900"'));assert(!svg.includes('foreignObject'));
 const s=p.slides.add();s.background.fill='#fffdf8';
 s.images.add({svg,alt:content.claim,fit:'contain',position:{left:0,top:0,width:1600,height:900}});
 s.speakerNotes.text=`[Spoken]\n${content.spoken}\n\n[Stage direction]\n${content.cue}\n\n[Evidence]\n${content.status}\n\n[Sources]\n${content.sources.join('\n')}${i===16?'\n\n'+qa:''}`;
 s.speakerNotes.setVisible(true);
}
const draft=path.join(build,'candidate.pptx');
await(await PresentationFile.exportPptx(p)).save(draft);
const result=await finalizePresentation({workspaceDir,candidatePath:draft,finalPath:path.join(output,'Focaccia - EPQ Story.pptx'),explicitTotalSlideCount:17,
 pythonExecutable:'/Users/manavcodaty/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','15240000,8572500'],
 requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],verifyArtifactToolImport:true,
 receiptPath:path.join(build,'final-validation.json')});
console.log(JSON.stringify({file:result.finalPath,slideCount:result.packageIntegrity.slide_count,import:result.firstPartyImport.passed}));
