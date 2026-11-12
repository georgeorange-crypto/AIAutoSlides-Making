import {critiqueDeck} from './critic.mjs';

export const CLAIM_RULES=['CLAIM-001','CLAIM-002','CLAIM-003'];

export function evaluateClaimCritic(annotation,evidence){
  if(!Array.isArray(annotation?.cases)||!annotation.cases.length)throw new Error('Evaluation set requires nonempty cases[]');
  const rows=annotation.cases.map(testCase=>{
    const deck={meta:{title:`Evaluation ${testCase.id}`},slides:[{slide_id:'S01',type:'statement',title:testCase.claim,assertion_title:testCase.claim,body:['Synthetic evaluation fixture'],evidence_ids:['EVAL1']} ]};
    if(testCase.state!=='missing')deck.slides[0].claim_support=[{evidence_id:'EVAL1',claim_text:testCase.claim,source_excerpt:'Synthetic excerpt; not a real research source.',locator:'fixture row 1',review_status:testCase.state,...(testCase.state==='verified'?{reviewer:'fixture annotator',reviewed_at:'2026-11-12T00:00:00Z'}:{})}];
    const predicted=[...new Set(critiqueDeck(deck,evidence).issues.map(x=>x.rule_id).filter(id=>CLAIM_RULES.includes(id)))],expected=testCase.expected||[];
    return{id:testCase.id,expected,predicted,correct:CLAIM_RULES.filter(id=>expected.includes(id)===predicted.includes(id))};
  });
  const rules=Object.fromEntries(CLAIM_RULES.map(rule=>{
    const tp=rows.filter(x=>x.expected.includes(rule)&&x.predicted.includes(rule)).length,fp=rows.filter(x=>!x.expected.includes(rule)&&x.predicted.includes(rule)).length,fn=rows.filter(x=>x.expected.includes(rule)&&!x.predicted.includes(rule)).length,tn=rows.length-tp-fp-fn;
    return[rule,{tp,fp,fn,tn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,f1:tp+fp+fn?2*tp/(2*tp+fp+fn):null}];
  }));
  return{schema_version:1,case_count:rows.length,annotation_method:annotation.annotation_method||'Unspecified',scope:'Classification of explicit claim-to-source review states only; not semantic truth or support detection.',rules,rows};
}

export function evaluationMarkdown(result){
  const pct=value=>value===null?'N/A':`${(value*100).toFixed(1)}%`;
  return[`# Slide Critic claim review evaluation`,'',`Cases: **${result.case_count}**`,'',`Annotation: ${result.annotation_method}`,'',`Scope: ${result.scope}`,'','| Rule | TP | FP | FN | TN | Precision | Recall | F1 |','|---|---:|---:|---:|---:|---:|---:|---:|',...Object.entries(result.rules).map(([rule,m])=>`| ${rule} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} |`),'','## Interpretation','',`The cases are hand-labeled synthetic software fixtures (English and Chinese claim wording), not a sample of real slide decks. These metrics show whether the implementation matches the stated review-state contract on this fixture set; they do **not** estimate real-world critic accuracy, semantic entailment, or scientific truth.`,'','| Case | Expected rules | Detected rules |','|---|---|---|',...result.rows.map(r=>`| ${r.id} | ${r.expected.join(', ')||'—'} | ${r.predicted.join(', ')||'—'} |`),''].join('\n');
}
