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
// Native Graphviz and Chromium-backed Marp exports can stall when they compete
// with the parallel Python, PowerPoint, and ZIP integration tests. Run their
// real renderer E2Es after the general suite, one backend at a time.
const graphvizFiles=files.filter(file=>path.basename(file)==='graphviz-adapter.test.mjs');
const d2Files=files.filter(file=>path.basename(file)==='d2-adapter.test.mjs');
const marpFiles=files.filter(file=>path.basename(file)==='marp-adapter.test.mjs');
const serialFiles=new Set([...graphvizFiles,...d2Files,...marpFiles]);
const parallelFiles=files.filter(file=>!serialFiles.has(file));
for(const group of [parallelFiles,graphvizFiles,d2Files,marpFiles].filter(items=>items.length)){
  const result=spawnSync(process.execPath,['--test','--test-concurrency=4',...group],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status??1;break;}
}
