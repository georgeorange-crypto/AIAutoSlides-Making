import {resolve} from 'node:path';
import {slidevAdapter} from '../packages/adapters/slidev.mjs';

function options(args) {
  const result={};
  for(let i=0;i<args.length;i++) {
    const key=args[i];
    if(!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const name=key.slice(2),value=args[++i];
    if(!value||value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    if(name==='formats') result.formats=value.split(',').map(x=>x.trim()).filter(Boolean);
    else if(name==='input') result.inputFile=resolve(value);
    else if(name==='out') result.outputDir=resolve(value);
    else if(name==='lineage') result.lineageFile=resolve(value);
    else throw new Error(`Unknown option: ${key}`);
  }
  return result;
}

try {
  const result=await slidevAdapter.run(options(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
} catch(error) {
  process.stderr.write(`Slidev backend failed: ${error.message}\n`);
  process.exitCode=1;
}
