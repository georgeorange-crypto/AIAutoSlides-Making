import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const required=['pptxgenjs','fflate','pdfjs-dist'],missing=[];
for(const name of required){try{let dir=path.dirname(require.resolve(name)),pkg;while(dir!==path.dirname(dir)){const file=path.join(dir,'package.json');if(fs.existsSync(file)){pkg=JSON.parse(fs.readFileSync(file,'utf8'));if(pkg.name===name)break;}dir=path.dirname(dir);}if(!pkg||pkg.name!==name)throw new Error('package metadata not found');console.log(`${name}@${pkg.version} (${pkg.license||'license unspecified'})`);}catch{missing.push(name);}}
if(missing.length){console.error(`Missing runtime dependencies: ${missing.join(', ')}. Run npm ci from the project root.`);process.exit(1);}
