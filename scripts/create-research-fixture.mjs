import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target=path.join(root,'examples/research-workflow/fixtures/synthetic-paper.pdf');
const lines=[
 'SYNTHETIC FIXTURE PAPER - NOT RESEARCH EVIDENCE',
 'Purpose: test local PDF extraction and source provenance.',
 'Example protocol: pair a local PDF with a labeled synthetic CSV.',
 'No experiment was run. No performance finding is asserted.'
];
const escape=s=>s.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
const commands=lines.map((line,i)=>`BT /F1 12 Tf 72 ${740-i*24} Td (${escape(line)}) Tj ET`).join('\n');
const stream=Buffer.from(commands,'ascii');
const objects=[
 '<< /Type /Catalog /Pages 2 0 R >>',
 '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 `<< /Length ${stream.length} >>\nstream\n${commands}\nendstream`
];
let pdf='%PDF-1.4\n% synthetic fixture\n';const offsets=[0];
for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,'ascii'));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
const xref=Buffer.byteLength(pdf,'ascii');pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(pdf,'ascii'));
console.log(`Wrote labeled synthetic PDF fixture: ${path.relative(root,target)}`);
