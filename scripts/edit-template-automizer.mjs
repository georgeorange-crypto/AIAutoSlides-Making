#!/usr/bin/env node
import {pptxAutomizerAdapter} from '../packages/adapters/pptx-automizer.mjs';

const values=new Map();const args=process.argv.slice(2);
if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: npm run template:edit -- --input <source.pptx> --out <new.pptx> --slide <1-based-number> --element <exact-shape-name> --text <replacement>');process.exit(0);}
for(let i=0;i<args.length;i++){const key=args[i];if(!['--input','--out','--slide','--element','--text'].includes(key)||!args[i+1])throw new Error(`Unexpected or missing value for ${key}.`);values.set(key,args[++i]);}
const slide=Number(values.get('--slide'));
if(!values.has('--input')||!values.has('--out')||!Number.isInteger(slide)||slide<1||!values.has('--element')||!values.has('--text'))throw new Error('Provide --input, --out, positive --slide, exact --element, and --text.');
const result=await pptxAutomizerAdapter.run({inputFile:values.get('--input'),outputFile:values.get('--out'),slideNumber:slide,elementName:values.get('--element'),text:values.get('--text')});
console.log(JSON.stringify(result,null,2));
