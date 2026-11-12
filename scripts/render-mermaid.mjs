import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mermaidAdapter} from '../packages/adapters/mermaid.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),args=process.argv.slice(2),get=name=>{const i=args.indexOf(`--${name}`);return i<0?null:args[i+1];};
if(args.includes('--help')||!get('input')){console.log('Usage: node scripts/render-mermaid.mjs --input diagram.mmd [--format svg|png|pdf] [--theme neutral|default|dark|forest|base] [--out-dir outputs/mermaid]');process.exitCode=args.includes('--help')?0:2;}
else try{const result=await mermaidAdapter.run({inputFile:path.resolve(get('input')),outputDir:path.resolve(get('out-dir')||path.join(root,'outputs','mermaid')),format:get('format')||'svg',theme:get('theme')||'neutral'});for(const file of result.artifacts)console.log(file);console.log(JSON.stringify(result.report,null,2));}catch(error){console.error(`[Mermaid render failed] ${error.message}`);process.exitCode=1;}
