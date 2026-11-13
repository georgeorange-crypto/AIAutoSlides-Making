#!/usr/bin/env node
// Offline synthetic proof that planner process/architecture needs become editable PPTX objects.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditPlannerQuality,createPlannerDraft} from '../src/ai-plan-contract.mjs';
import {loadEvidence,validateDeck} from '../src/validate.mjs';
import {generatePresentation} from '../src/render.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtureDir=path.join(root,'examples/open-source-bakeoff/ai-plan');
const response=JSON.parse(fs.readFileSync(path.join(fixtureDir,'response.json'),'utf8'));
const ledger=loadEvidence(path.join(fixtureDir,'evidence.json'));
const quality=auditPlannerQuality(response);
if(quality.status!=='pass')throw new Error(`Synthetic planner fixture is blocked: ${quality.findings.map(item=>item.rule_id).join(', ')}`);
const {deck,errors}=validateDeck(createPlannerDraft(response,{audienceProfile:'research_group',duration:7,goal:'Demonstrate native editable process and architecture visuals'}),ledger);
if(errors.length)throw new Error(`Synthetic planner fixture failed storyboard validation: ${errors.join('; ')}`);
const outputDir=path.join(root,'outputs/planner-visual-demo');
fs.mkdirSync(outputDir,{recursive:true});
const output=path.join(outputDir,'synthetic-planner-demo.pptx');
await generatePresentation(deck,ledger,JSON.parse(fs.readFileSync(path.join(root,'themes/academic-light.json'),'utf8')),output);
process.stdout.write(`${JSON.stringify({output:path.relative(root,output).replaceAll('\\','/'),slide_count:deck.slides.length,quality:quality.metrics,editable_visuals:deck.slides.flatMap((slide,index)=>slide.steps||slide.diagram?[{slide_number:index+1,kind:slide.steps?'process':'architecture',steps:slide.steps?.length||0,nodes:slide.diagram?.nodes.length||0,edges:slide.diagram?.edges.length||0}]:[])},null,2)}\n`);
