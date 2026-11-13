import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {unzipSync,strFromU8,strToU8,zipSync} from 'fflate';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';
import {pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';
import {definePresentationAdapter} from '../packages/adapters/protocol.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const workspace=path.resolve(root,'outputs/quality-section-structure','run-'+runId);
const out=path.join(workspace,'runs','synthetic-sections');
const assistantVoiceStress=process.argv.includes('--assistant-voice-stress');
const layoutRepetitionStress=process.argv.includes('--layout-repetition-stress');
const sparseDensityStress=process.argv.includes('--sparse-density-stress');
const renderedTextOverflowStress=process.argv.includes('--rendered-text-overflow-stress');
const unmaterializedVisualStress=process.argv.includes('--unmaterialized-visual-stress');
const lowVisualCoverageStress=process.argv.includes('--low-visual-coverage-stress');
const evidenceLineageStress=process.argv.includes('--evidence-lineage-stress');
const transitionCaveatStress=process.argv.includes('--transition-caveat-stress');
const priorityTopicStress=process.argv.includes('--priority-topic-stress');
const fontMismatchStress=process.argv.includes('--font-mismatch-stress');
const priorityDepthStress=process.argv.includes('--priority-depth-stress');
const duplicatePriorityExplanationStress=process.argv.includes('--duplicate-priority-explanation-stress');
const source={source_id:'E_SYN_SECTION',type:'synthetic_fixture',uri:'fixture://section-structure',locator:'synthetic fixture only',verification_status:'unverified'};
const text=(id,value)=>({element_id:id,kind:'text',text:value});
const bullets=(id,items)=>({element_id:id,kind:'bullets',items});
const processElement=(id,steps)=>({element_id:id,kind:'process',steps,source_ids:[source.source_id]});
const prose='本节以合成示例说明系统如何接收请求、选择执行路径并返回结果。每一步都对应一个清晰机制，并解释前后状态如何变化，使听众能够沿着因果顺序理解证据与结论之间的联系。';
const slides=[
 {slide_id:'S01',type:'bullets',title:'内容提要',evidence_ids:[source.source_id],elements:[bullets('S01-B01',['机制解析','实际影响'])]},
 {slide_id:'S02',type:'statement',title:'机制解析',evidence_ids:[source.source_id],elements:[text('S02-T01','本节先拆解请求如何进入系统、如何选择执行路径，再说明结果怎样返回调用者。') ]},
 {slide_id:'S03',type:'process',title:'请求经过三个明确阶段',assertion_title:'请求经历入口、调度与返回三个阶段',evidence_ids:[source.source_id],elements:[text('S03-T01',assistantVoiceStress?`${prose} 希望这能对您有帮助；如果您愿意，请告诉我还想了解什么。`:`${prose} 这一结构决定请求经过的控制边界；应逐步核对每个阶段的输入和输出，才能定位异常发生的位置。`),processElement('S03-P01',['接收请求','选择路径','返回结果'])]},
 {slide_id:'S04',type:'statement',title:'调度选择决定执行路径',assertion_title:'调度策略把请求映射到不同执行路径',evidence_ids:[source.source_id],elements:[text('S04-T01','调度器根据请求类型和当前资源状态选定执行路径。路径一旦选定，后续处理顺序随之确定，因而请求路由是连接入口与结果的关键决策点。若请求特征相同但资源状态不同，调度仍可能选择不同路线，因此需要同时分析这两类输入。比较不同路径时，还应追踪分支条件及其对后续处理的影响。'),text('S04-T02','对每条路径都应说明选择依据、资源状态与预期行为，才能将策略差异和实际观察对应起来。可按“请求特征—分支条件—执行路径”的顺序讲清决策链，并分别解释各分支可观察到的结果；缺少条件时，听众就无法判断路径差异从何而来。')]},
 {slide_id:'S05',type:'statement',title:'实际影响',evidence_ids:[source.source_id],elements:[text('S05-T01','本节再观察不同路径如何影响资源等待、执行时间与用户看到的最终响应。') ]},
 {slide_id:'S06',type:'process',title:'影响沿着请求链条逐步传递',assertion_title:'路径变化影响等待、执行与最终响应',evidence_ids:[source.source_id],elements:[text('S06-T01',`${prose} 若等待时间上升，应先区分调度变化与执行负载，再解释其如何传递到响应时延。`),processElement('S06-P01',['路径变化','资源等待','响应变化'])]},
 {slide_id:'S07',type:'statement',title:'结论回到用户可观察的变化',assertion_title:'机制解释可以对应到可观察的结果',evidence_ids:[source.source_id],elements:[text('S07-T01','因此，调度选择先改变请求等待和执行顺序，再影响最终响应。观察响应变化时，应先定位发生变化的阶段，才能解释资源消耗与用户体验之间的联系。还要对照各阶段的观测指标，确认变化链条与证据一致，再形成结论。这让机制解释可以对应到用户实际观察到的响应变化。')]}
];
if(layoutRepetitionStress){
 const [agenda,mechanismDivider,mechanismProcess,mechanismStatement,impactDivider,impactProcess,impactStatement]=slides;
 const duplicate=(template,slide_id)=>{const copy=structuredClone(template);copy.slide_id=slide_id;copy.title=`重复模板压力页 ${slide_id}`;copy.assertion_title=`用同一版式复述合成步骤 ${slide_id}`;copy.elements.forEach((element,index)=>element.element_id=`${slide_id}-E${index+1}`);return copy;};
 const closing={slide_id:'S12',type:'closing',title:'合成版式压力测试结束',evidence_ids:[source.source_id],elements:[text('S12-T01','以上页面只用于验证正式质量门禁能否识别交替复用的版式。')]};
 slides.splice(0,slides.length,agenda,mechanismDivider,mechanismProcess,mechanismStatement,duplicate(mechanismProcess,'S08'),duplicate(mechanismStatement,'S09'),impactDivider,impactProcess,impactStatement,duplicate(impactProcess,'S10'),duplicate(impactStatement,'S11'),closing);
}
if(sparseDensityStress){const target=slides.find(slide=>slide.slide_id==='S04');target.elements=target.elements.slice(0,1);target.elements[0].text='调度决定请求的执行路径。';}
if(renderedTextOverflowStress){const target=slides.find(slide=>slide.slide_id==='S04');target.elements=[text('S04-T01','调度器根据请求类型和当前资源状态选定执行路径。路径一旦选定，后续处理顺序随之确定，因而请求路由是连接入口与结果的关键决策点。若请求特征相同但资源状态不同，调度仍可能选择不同路线，因此需要同时分析这两类输入。比较不同路径时，还应追踪分支条件及其对后续处理的影响。'.repeat(2))];}
if(duplicatePriorityExplanationStress){slides.find(slide=>slide.slide_id==='S04').elements[0].text=slides.find(slide=>slide.slide_id==='S03').elements[0].text;}
if(unmaterializedVisualStress){for(const slideId of ['S03','S06']){const target=slides.find(slide=>slide.slide_id===slideId);target.type='statement';target.elements=target.elements.filter(element=>element.kind!=='process');target.elements.push({element_id:`${slideId}-M01`,kind:'mermaid',source:'flowchart LR\nA -.- B',source_ids:[source.source_id]});}}
if(lowVisualCoverageStress)slides.push({slide_id:'S08',type:'statement',title:'补充的合成解释页',assertion_title:'补充页面不改变视觉覆盖的强制下限',evidence_ids:[source.source_id],elements:[text('S08-T01',prose)]});
if(transitionCaveatStress)for(const slideId of ['S02','S03','S04'])slides.find(slide=>slide.slide_id===slideId).elements[0].text+=' 本结论不代表因果关系。';
for(const slide of slides)slide.speaker_notes=assistantVoiceStress&&slide.slide_id==='S03'?'如果您愿意，请告诉我还希望补充什么内容。':'仅供软件验收的合成说明，不包含研究结论。';
const presentationIR={schema_version:'1.0.0',meta:{title:'合成章节结构验收',audience:'QA reader',goal:'验证目录与章节映射',status:'SYNTHETIC QA FIXTURE — NOT RESEARCH DATA'},source_ir:{schema_version:'1.0.0',sources:[source]},slides};
const roles=layoutRepetitionStress?['agenda','section_transition','mechanism','mechanism','mechanism','mechanism','section_transition','implications','implications','implications','implications','closing']:['agenda','section_transition','mechanism','mechanism','section_transition','implications','implications',...(lowVisualCoverageStress?['implications']:[])];
const sections=layoutRepetitionStress?[null,'机制解析','机制解析','机制解析','机制解析','机制解析','实际影响','实际影响','实际影响','实际影响','实际影响',null]:[null,'机制解析','机制解析','机制解析','实际影响','实际影响','实际影响',...(lowVisualCoverageStress?['实际影响']:[])];
const coreIds=layoutRepetitionStress?new Set(['S03','S08','S06','S10']):priorityTopicStress?new Set(['S03','S04','S06']):new Set(['S03','S04','S06','S07']);
const plan={schema_version:'1.2.0',task:{target_duration_seconds:layoutRepetitionStress?720:420,expected_slide_count:slides.length},quality_contract:{language:'Chinese',content_priorities:['机制解析','实际影响'],priority_depth:[{priority_id:'机制解析',depth_level:priorityDepthStress?'deep':'standard',minimum_core_slides:priorityDepthStress?7:2},{priority_id:'实际影响',depth_level:'standard',minimum_core_slides:2}],narrative_sections:['机制解析','实际影响'],visual_slide_ratio_min:0.5,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},slides:slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:roles[index],...(sections[index]?{section_name:sections[index]}:{}),importance:coreIds.has(slide.slide_id)?'core':['mechanism','implications'].includes(roles[index])?'supporting':'standard',...(sections[index]?{priority_ids:coreIds.has(slide.slide_id)?[priorityTopicStress&&sections[index]==='实际影响'?'机制解析':sections[index]]:priorityTopicStress&&slide.slide_id==='S07'?['实际影响']:[]}:{}),visual_type:slide.elements.some(element=>element.kind==='process')?'process':'text',layout_intent:layoutRepetitionStress&&['mechanism','implications'].includes(roles[index])?`unique-label-${slide.slide_id}`:slide.type,evidence_ids:slide.slide_id==='S04'&&evidenceLineageStress?[]:slide.evidence_ids||[]}))};
const corruptFontAdapter=fontMismatchStress?definePresentationAdapter({
 manifest:{...pptxgenjsIRAdapter.manifest,id:'pptxgenjs-ir-font-stress'},
 async probe(){return pptxgenjsIRAdapter.probe();},
 async capabilities(){return pptxgenjsIRAdapter.capabilities();},
 async export(request){return pptxgenjsIRAdapter.export(request);},
 async render(request){
 const rendered=await pptxgenjsIRAdapter.render(request),pptx=rendered.artifacts.find(item=>item.format==='pptx')?.path;
 if(!pptx)throw new Error('Font mismatch fixture did not produce a PPTX');
 const packageFiles=unzipSync(new Uint8Array(fs.readFileSync(pptx))),slide='ppt/slides/slide3.xml',xml=strFromU8(packageFiles[slide]);
 if(!xml.includes('typeface="Aptos"'))throw new Error('Expected theme body font was absent from the rendered synthetic slide');
 packageFiles[slide]=strToU8(xml.replace('typeface="Aptos"','typeface="Comic Sans MS"'));
 fs.writeFileSync(pptx,zipSync(packageFiles));
 execFileSync(process.execPath,[path.join(root,'src/qa.mjs'),pptx],{cwd:root,stdio:'ignore',windowsHide:true});
 const qaPath=pptx.replace(/\.pptx$/i,'.qa.json'),qa=JSON.parse(fs.readFileSync(qaPath,'utf8'));
 const manifestPath=pptx.replace(/\.pptx$/i,'.run-manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 for(const output of manifest.outputs||[]){const file=path.join(path.dirname(pptx),output.path);if(fs.existsSync(file))output.sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
 fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
 rendered.qa={status:qa.status,errors:qa.errors,warnings:qa.warnings,chartValuesExact:qa.chartData.exactMatch};
 for(const artifact of rendered.artifacts){if(fs.existsSync(artifact.path))artifact.sha256=crypto.createHash('sha256').update(fs.readFileSync(artifact.path)).digest('hex');}
 return rendered;
 }
}):pptxgenjsIRAdapter;
const result=await runPresentationWorkflow({jobId:'synthetic-section-structure-proof',presentationIR,qualityPlan:plan,workspace,outputDir:out,preview:true,adapters:[fontMismatchStress?corruptFontAdapter:pptxgenjsIRAdapter]});
const gate=result.report.critique.quality_gate;
const voiceBlockers=gate.blockers.filter(item=>item.code==='QUALITY_ASSISTANT_VOICE');
const layoutBlockers=gate.blockers.filter(item=>item.code==='QUALITY_LAYOUT_DIVERSITY');
const densityBlockers=gate.blockers.filter(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW');
const expectedBlockers=[...(assistantVoiceStress?['QUALITY_ASSISTANT_VOICE']:[]),...(layoutRepetitionStress?['QUALITY_LAYOUT_DIVERSITY']:[]),...(sparseDensityStress?['QUALITY_VISIBLE_DENSITY_LOW']:[]),...(renderedTextOverflowStress?['QUALITY_RENDERED_TEXT_OVERFLOW']:[]),...(unmaterializedVisualStress||lowVisualCoverageStress?['QUALITY_VISUAL_COVERAGE']:[]),...(evidenceLineageStress?['QUALITY_PLAN_EVIDENCE_MISSING']:[]),...(transitionCaveatStress?['QUALITY_CAVEAT_REPETITION']:[]),...(priorityTopicStress?['QUALITY_PRIORITY_UNCOVERED']:[]),...(fontMismatchStress?['QUALITY_FONT_MISMATCH']:[]),...(priorityDepthStress?['QUALITY_PRIORITY_DEPTH_UNDERALLOCATED']:[]),...(duplicatePriorityExplanationStress?['QUALITY_PRIORITY_EXPLANATION_DUPLICATED']:[])];
if(expectedBlockers.length?expectedBlockers.some(code=>!gate.blockers.some(item=>item.code===code)):gate.blockers.length)throw new Error(`Synthetic section fixture did not meet the expected ${expectedBlockers.length?'stress-blocked':'pass'} result: ${gate.blockers.map(item=>item.code).join(', ')}`);
console.log(JSON.stringify({status:result.status,slides:slides.length,assistant_voice_stress:assistantVoiceStress,layout_repetition_stress:layoutRepetitionStress,sparse_density_stress:sparseDensityStress,rendered_text_overflow_stress:renderedTextOverflowStress,unmaterialized_visual_stress:unmaterializedVisualStress,low_visual_coverage_stress:lowVisualCoverageStress,evidence_lineage_stress:evidenceLineageStress,transition_caveat_stress:transitionCaveatStress,priority_topic_stress:priorityTopicStress,font_mismatch_stress:fontMismatchStress,priority_depth_stress:priorityDepthStress,duplicate_priority_explanation_stress:duplicatePriorityExplanationStress,visual_coverage:{visual_slide_count:gate.visual_slide_count,content_slide_count:gate.content_slide_count,visual_slide_ratio:gate.visual_slide_ratio,minimum_visual_slide_ratio:gate.minimum_visual_slide_ratio,unmaterialized_visuals:gate.unmaterialized_visuals},density_findings:densityBlockers.map(item=>({slide_id:item.slide_id,occupancy:item.visible_text_occupancy_ratio,line_count:item.visible_text_line_count,minimum_ratio:item.minimum_ratio,minimum_line_count:item.minimum_line_count})),overflow_findings:gate.blockers.filter(item=>item.code==='QUALITY_RENDERED_TEXT_OVERFLOW').map(item=>({slide_id:item.slide_id,word_count:item.body_text_overflow_word_count})),layout_diversity:gate.layout_diversity,priority_topic_coverage:gate.priority_topic_coverage,quality_gate:{status:gate.status,blockers:gate.blockers.map(item=>({code:item.code,slide_id:item.slide_id,priority:item.priority,slide_ids:item.slide_ids,location:item.location,unexpected_font_families:item.unexpected_font_families,expected_theme_fonts:item.expected_theme_fonts,missing_evidence_ids:item.missing_evidence_ids,unmaterialized_visuals:item.unmaterialized_visuals})),warnings:gate.warnings.map(item=>item.code)},render_warnings:result.report.critique.structural.renderer_warnings.filter(item=>/Mermaid source was preserved as text/.test(item)),preview:result.preview,artifacts:result.artifacts.filter(item=>item.format==='pptx').map(({path,format,sha256})=>({path,format,sha256}))},null,2));
