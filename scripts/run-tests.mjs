#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const testDir=path.resolve('tests');
const files=fs.readdirSync(testDir,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&entry.name.endsWith('.test.mjs'))
  .map(entry=>path.join(testDir,entry.name))
  .sort();
if(!files.length)throw new Error(`No test files found in ${testDir}`);
// Native renderers and archive-heavy PPTX automation should not compete with
// parallel Python, PowerPoint, and ZIP integration tests. Run backend E2Es
// after the general suite, one at a time.
const graphvizFiles=files.filter(file=>path.basename(file)==='graphviz-adapter.test.mjs');
const d2Files=files.filter(file=>path.basename(file)==='d2-adapter.test.mjs');
const quartoFiles=files.filter(file=>path.basename(file)==='quarto-adapter.test.mjs');
const libreOfficeFiles=files.filter(file=>path.basename(file)==='libreoffice-adapter.test.mjs');
const marpFiles=files.filter(file=>path.basename(file)==='marp-adapter.test.mjs');
const automizerFiles=files.filter(file=>path.basename(file)==='pptx-automizer.test.mjs');
const serialFiles=new Set([...graphvizFiles,...d2Files,...quartoFiles,...libreOfficeFiles,...marpFiles,...automizerFiles]);
const parallelFiles=files.filter(file=>!serialFiles.has(file));
for(const group of [parallelFiles,graphvizFiles,d2Files,quartoFiles,libreOfficeFiles,marpFiles,automizerFiles].filter(items=>items.length)){
  const result=spawnSync(process.execPath,['--test','--test-concurrency=4',...group],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status??1;break;}
}
