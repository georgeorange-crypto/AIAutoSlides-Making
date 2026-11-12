import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compilePresentationIR} from '../packages/adapters/slidev-ir.mjs';

function parse(args) {
  const values={};
  for(let i=0;i<args.length;i++) {
    const flag=args[i],value=args[++i];
    if(!['--input','--out'].includes(flag)||!value||value.startsWith('--')) throw new Error('Usage: node scripts/slidev-from-ir.mjs --input <presentation-ir.json> --out <directory>');
    values[flag.slice(2)]=path.resolve(value);
  }
  if(!values.input||!values.out) throw new Error('Usage: node scripts/slidev-from-ir.mjs --input <presentation-ir.json> --out <directory>');
  return values;
}

try {
  const {input,out}=parse(process.argv.slice(2)),bytes=await readFile(input),ir=JSON.parse(bytes.toString('utf8'));
  const result=compilePresentationIR(ir);
  await mkdir(out,{recursive:true});
  const markdownPath=path.join(out,'presentation.md'),lineagePath=path.join(out,'slide-lineage.json'),reportPath=path.join(out,'ir-to-slidev-manifest.json');
  await writeFile(markdownPath,result.markdown);
  await writeFile(lineagePath,JSON.stringify(result.lineage,null,2)+'\n');
  const report={mapper:'presentation-ir-to-slidev-markdown',version:'1.0.0',input:{path:path.basename(input),sha256:createHash('sha256').update(bytes).digest('hex')},source_ir_sha256:result.sourceIrSha256,slides:result.lineage.slides.length,markdown_sha256:createHash('sha256').update(result.markdown).digest('hex'),lineage_sha256:createHash('sha256').update(await readFile(lineagePath)).digest('hex'),warnings:result.lineage.sources.filter(source=>source.verification_status!=='verified').map(source=>`Source ${source.source_id} remains ${source.verification_status}; mapping does not verify it.`)};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(`${JSON.stringify({markdownPath,lineagePath,reportPath,slides:report.slides,warnings:report.warnings},null,2)}\n`);
} catch(error) {
  process.stderr.write(`IR to Slidev conversion failed: ${error.message}\n`);
  process.exitCode=1;
}
