import {assertValidPresentationIR} from './validate-presentation.mjs';

const PATCHABLE=new Set(['title','assertion_title','speaker_notes','evidence_ids','elements']);

export function patchPresentationSlide(presentationIR,slideId,patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new TypeError('slide patch must be an object');
  const unknown=Object.keys(patch).filter(key=>!PATCHABLE.has(key));
  if(unknown.length)throw new Error(`Unsupported slide patch fields: ${unknown.join(', ')}`);
  const index=presentationIR.slides.findIndex(slide=>slide.slide_id===slideId);
  if(index<0)throw new Error(`Unknown slide_id '${slideId}'`);
  const slides=presentationIR.slides.map((slide,i)=>i===index?{...slide,...structuredClone(patch),slide_id:slide.slide_id}:slide);
  const updated={...structuredClone(presentationIR),slides};
  assertValidPresentationIR(updated);
  return updated;
}
