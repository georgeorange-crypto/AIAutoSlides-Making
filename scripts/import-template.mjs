#!/usr/bin/env node
import {registerPresentationTemplate} from '../src/templates/import-template.mjs';

const args=process.argv.slice(2);if(args.length===1&&(args[0]==='--help'||args[0]==='-h')){
  console.log('Usage: node scripts/import-template.mjs <template.pptx|template.potx> --out <registry-entry.json>');
  process.exit(0);
}
const input=args[0];let output;
for(let i=1;i<args.length;i++){
  if(args[i]==='--out')output=args[++i];
  else if(args[i]==='--help'||args[i]==='-h'){
    console.log('Usage: node scripts/import-template.mjs <template.pptx|template.potx> --out <registry-entry.json>');
    process.exit(0);
  }else throw new Error(`Unknown argument: ${args[i]}`);
}
if(!input||!output)throw new Error('Provide a local PPTX/POTX path and --out registry-entry.json.');
const record=registerPresentationTemplate(input,output);
console.log(JSON.stringify({template_id:record.template_id,registry:output,sha256:record.file.sha256,slides:record.package.slide_count,rights:record.rights.state,usable_for_generation:record.availability.usable_for_generation},null,2));
