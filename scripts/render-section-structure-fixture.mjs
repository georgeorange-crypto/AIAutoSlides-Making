import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';
import {pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const workspace=path.resolve(root,'outputs/quality-section-structure','run-'+runId);
const out=path.join(workspace,'runs','synthetic-sections');
const assistantVoiceStress=process.argv.includes('--assistant-voice-stress');
const source={source_id:'E_SYN_SECTION',type:'synthetic_fixture',uri:'fixture://section-structure',locator:'synthetic fixture only',verification_status:'unverified'};
const text=(id,value)=>({element_id:id,kind:'text',text:value});
const bullets=(id,items)=>({element_id:id,kind:'bullets',items});
const processElement=(id,steps)=>({element_id:id,kind:'process',steps,source_ids:[source.source_id]});
const prose='本节以合成示例说明系统如何接收请求、选择执行路径并返回结果。每一步都对应一个清晰机制，并解释前后状态如何变化，使听众能够沿着因果顺序理解证据与结论之间的联系。';
const slides=[
 {slide_id:'S01',type:'bullets',title:'内容提要',evidence_ids:[source.source_id],elements:[bullets('S01-B01',['机制解析','实际影响'])]},
 {slide_id:'S02',type:'statement',title:'机制解析',evidence_ids:[source.source_id],elements:[text('S02-T01','本节先拆解请求如何进入系统、如何选择执行路径，再说明结果怎样返回调用者。') ]},
 {slide_id:'S03',type:'process',title:'请求经过三个明确阶段',assertion_title:'请求经历入口、调度与返回三个阶段',evidence_ids:[source.source_id],elements:[text('S03-T01',assistantVoiceStress?`${prose} 希望这能对您有帮助；如果您愿意，请告诉我还想了解什么。`:prose),processElement('S03-P01',['接收请求','选择路径','返回结果'])]},
 {slide_id:'S04',type:'statement',title:'调度选择决定执行路径',assertion_title:'调度策略把请求映射到不同执行路径',evidence_ids:[source.source_id],elements:[text('S04-T01',prose)]},
 {slide_id:'S05',type:'statement',title:'实际影响',evidence_ids:[source.source_id],elements:[text('S05-T01','本节再观察不同路径如何影响资源等待、执行时间与用户看到的最终响应。') ]},
 {slide_id:'S06',type:'process',title:'影响沿着请求链条逐步传递',assertion_title:'路径变化影响等待、执行与最终响应',evidence_ids:[source.source_id],elements:[text('S06-T01',prose),processElement('S06-P01',['路径变化','资源等待','响应变化'])]},
 {slide_id:'S07',type:'statement',title:'结论回到用户可观察的变化',assertion_title:'机制解释可以对应到可观察的结果',evidence_ids:[source.source_id],elements:[text('S07-T01',prose)]}
];
for(const slide of slides)slide.speaker_notes=assistantVoiceStress&&slide.slide_id==='S03'?'如果您愿意，请告诉我还希望补充什么内容。':'仅供软件验收的合成说明，不包含研究结论。';
const presentationIR={schema_version:'1.0.0',meta:{title:'合成章节结构验收',audience:'QA reader',goal:'验证目录与章节映射',status:'SYNTHETIC QA FIXTURE — NOT RESEARCH DATA'},source_ir:{schema_version:'1.0.0',sources:[source]},slides};
const roles=['agenda','section_transition','mechanism','mechanism','section_transition','implications','implications'];
const sections=[null,'机制解析','机制解析','机制解析','实际影响','实际影响','实际影响'];
const plan={task:{target_duration_seconds:420,expected_slide_count:slides.length},quality_contract:{language:'Chinese',narrative_sections:['机制解析','实际影响'],visual_slide_ratio_min:0.4,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},slides:slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:roles[index],...(sections[index]?{section_name:sections[index]}:{}),importance:['S03','S04'].includes(slide.slide_id)?'core':['S06','S07'].includes(slide.slide_id)?'supporting':'standard',visual_type:slide.elements.some(element=>element.kind==='process')?'process':'text',layout_intent:slide.type}))};
const result=await runPresentationWorkflow({jobId:'synthetic-section-structure-proof',presentationIR,qualityPlan:plan,workspace,outputDir:out,preview:true,adapters:[pptxgenjsIRAdapter]});
const gate=result.report.critique.quality_gate;
const voiceBlockers=gate.blockers.filter(item=>item.code==='QUALITY_ASSISTANT_VOICE');
if(assistantVoiceStress?!voiceBlockers.length:gate.blockers.length)throw new Error(`Synthetic section fixture did not meet the expected ${assistantVoiceStress?'voice-blocked':'pass'} result: ${gate.blockers.map(item=>item.code).join(', ')}`);
console.log(JSON.stringify({status:result.status,slides:slides.length,assistant_voice_stress:assistantVoiceStress,quality_gate:{status:gate.status,blockers:gate.blockers.map(item=>item.code),warnings:gate.warnings.map(item=>item.code)},preview:result.preview,artifacts:result.artifacts.filter(item=>item.format==='pptx').map(({path,format,sha256})=>({path,format,sha256}))},null,2));
