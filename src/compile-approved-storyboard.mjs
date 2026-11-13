import crypto from 'node:crypto';
import {migrateLegacyEvidence} from '../packages/contracts/migrate.mjs';
import {createDeckIR} from '../packages/core/models.mjs';
import {auditPlannerQuality} from './ai-plan-contract.mjs';
import {buildGateError} from './review-state.mjs';
import {validateDeck} from './validate.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

/** Compile an explicitly approved AI planner storyboard into canonical Presentation IR. */
export function compileApprovedStoryboard(storyboard,evidence,{sourcePath='storyboard.json',evidencePath='evidence.json'}={}){
  if(storyboard?.meta?.requires_human_review!==true)throw new Error('Input is not an AI storyboard marked as requiring human review.');
  const gate=buildGateError(storyboard);
  if(gate)throw new Error(gate);
  const entries=Array.isArray(evidence)?evidence:evidence?.entries;
  if(!Array.isArray(entries))throw new Error('Evidence ledger must contain entries[].');
  const evidenceIds=new Set();
  for(const [index,item] of entries.entries()){
    if(!item||typeof item.id!=='string'||!item.id.trim()||typeof item.label!=='string'||!item.label.trim()||typeof item.source!=='string'||!item.source.trim()||typeof item.verified!=='boolean')throw new Error(`Evidence ledger entry ${index+1} requires id, label, source and verified:boolean.`);
    if(evidenceIds.has(item.id))throw new Error(`Evidence ledger contains duplicate ID '${item.id}'.`);
    evidenceIds.add(item.id);
  }
  const validation=validateDeck(storyboard,evidence);
  if(validation.errors.length)throw new Error(`Storyboard validation failed: ${validation.errors.join('; ')}`);
  const quality=auditPlannerQuality({title:storyboard.meta.title,slides:storyboard.slides});
  if(quality.status!=='pass')throw new Error(`Planner quality gate blocked compilation: ${quality.findings.map(item=>`${item.rule_id}${item.slide?` slide ${item.slide}`:''}: ${item.message}`).join('; ')}`);
  const sourceIR=migrateLegacyEvidence(evidence,{sourcePath:evidencePath});
  const review=storyboard.meta.human_review;
  const coverIndex=storyboard.slides.findIndex(slide=>slide.type==='cover');
  const coverProcess=storyboard.slides.find(slide=>!['cover','closing'].includes(slide.type)&&Array.isArray(slide.steps)&&slide.steps.length>=3);
  const slides=storyboard.slides.map((slide,index)=>{
    const slideId=slide.slide_id||`S${String(index+1).padStart(2,'0')}`;
    const coverVisual=index===coverIndex&&coverProcess?{kind:'process',steps:coverProcess.steps.slice(0,3),source_ids:[...new Set(coverProcess.visual_needs?.find(item=>item.kind==='process')?.evidence_ids||coverProcess.evidence_ids||[])]}:null;
    const sources=[...new Set([...(slide.evidence_ids||[]),...(coverVisual?.source_ids||[])])];
    const elements=(slide.body||[]).map((text,n)=>({element_id:`${slideId}-T${String(n+1).padStart(2,'0')}`,kind:'text',text,source_ids:sources}));
    if(coverVisual)elements.push({element_id:`${slideId}-CV01`,kind:'process',steps:coverVisual.steps,source_ids:coverVisual.source_ids});
    let type=slide.type;
    if(slide.diagram){type='architecture';elements.push({element_id:`${slideId}-D01`,kind:'diagram',...structuredClone(slide.diagram),source_ids:sources});}
    if(slide.steps){type='process';elements.push({element_id:`${slideId}-P01`,kind:'process',steps:structuredClone(slide.steps),source_ids:sources});}
    return{
      slide_id:slideId,type,title:slide.title,assertion_title:slide.assertion_title||slide.title,
      role:slide.kicker||slide.type,evidence_ids:sources,elements,
      ...(slide.speaker_notes?{speaker_notes:slide.speaker_notes}:{}),
      design:{legacy_layout:slide.layout||null,visual_description:slide.figure_description||null,...(coverVisual?{cover_visual:coverVisual}:{})}
    };
  });
  const meta={...structuredClone(storyboard.meta),title:storyboard.meta.title,
    status:'Content review recorded; source verification remains as stated in evidence ledger',
    storyboard_review_status:'approved',human_review_record:{reviewer:review.reviewer,note:review.note,reviewed_at:review.reviewed_at,approved_content_sha256:review.content_sha256},
    requires_human_review:false,source_storyboard_sha256:sha256(Buffer.from(JSON.stringify(storyboard))),source_storyboard_path:sourcePath};
  delete meta.human_review;
  delete meta.draft_origin;
  return createDeckIR({meta,source_ir:sourceIR,slides});
}
