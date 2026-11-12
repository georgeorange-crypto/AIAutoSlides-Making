import crypto from 'node:crypto';

export function approvalContentHash(storyboard){
  const copy=JSON.parse(JSON.stringify(storyboard));
  if(copy.meta)delete copy.meta.human_review;
  return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

export function buildGateError(storyboard){
  if(storyboard?.meta?.requires_human_review!==true)return null;
  const review=storyboard.meta.human_review;
  if(!review||review.decision!=='approve'||!review.reviewer||!review.note||review.acknowledged_all_critic_findings!==true)return 'This AI storyboard is a draft. Run src/review-draft.mjs, inspect the critic findings, and record a human approval before building.';
  if(review.content_sha256!==approvalContentHash(storyboard))return 'Human approval is stale because storyboard content changed after review; review the edited file again.';
  return null;
}
