export function recordVisualDecision(review,{pptx_sha256,slide_id,decision,reviewer,note,reviewed_at=new Date().toISOString()}){
  if(!['approve','changes_requested'].includes(decision))throw new Error('decision must be approve or changes_requested');
  if(typeof reviewer!=='string'||!reviewer.trim())throw new Error('reviewer is required');
  if(typeof note!=='string'||!note.trim())throw new Error('a review note is required');
  if(review&&review.pptx_sha256!==pptx_sha256)throw new Error('Existing visual review belongs to a different PPTX hash; start a fresh review');
  const entries=new Map((review?.slides||[]).map(item=>[item.slide_id,item]));
  if(!entries.has(slide_id)&&!review?.allowed_slide_ids?.includes(slide_id))throw new Error(`Unknown slide ID ${slide_id}`);
  entries.set(slide_id,{slide_id,decision,reviewer:reviewer.trim(),note:note.trim(),reviewed_at});
  const slides=[...entries.values()].sort((a,b)=>a.slide_id.localeCompare(b.slide_id));
  const allowed=review?.allowed_slide_ids||slides.map(item=>item.slide_id);
  const complete=allowed.every(id=>slides.some(item=>item.slide_id===id));
  const status=!complete?'in_progress':slides.some(item=>item.decision==='changes_requested')?'changes_requested':'approved';
  return{schema_version:1,pptx_sha256,status,allowed_slide_ids:allowed,slides};
}
