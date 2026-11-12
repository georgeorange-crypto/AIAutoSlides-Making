import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {mermaidAdapter} from '../packages/adapters/mermaid.mjs';

test('Mermaid adapter rejects external resources, unsupported formats, and output traversal without requiring the worker',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-mermaid-negative-')),input=path.join(dir,'source.mmd');
 try{
  fs.writeFileSync(input,'flowchart LR\n A --> B\n');
  await assert.rejects(mermaidAdapter.run({inputFile:input,outputDir:dir,format:'jpg'}),/format must be svg, png, or pdf/);
  await assert.rejects(mermaidAdapter.run({inputFile:input,outputDir:dir,outputFile:path.join(dir,'..','escape.svg')}),/inside outputDir/);
  fs.writeFileSync(input,'flowchart LR\n A -->|https://example.invalid| B\n');
  await assert.rejects(mermaidAdapter.run({inputFile:input,outputDir:dir}),/Network and data URI references/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
