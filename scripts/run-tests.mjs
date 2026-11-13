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
// Chromium-backed Marp exports can stall when they compete with the parallel
// Python, PowerPoint, and ZIP integration tests. Run that real browser E2E
// after the rest of the suite so the test remains enabled without contention.
const marpFiles=files.filter(file=>path.basename(file)==='marp-adapter.test.mjs');
const parallelFiles=files.filter(file=>!marpFiles.includes(file));
for(const group of [parallelFiles,marpFiles].filter(items=>items.length)){
  const result=spawnSync(process.execPath,['--test','--test-concurrency=4',...group],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status??1;break;}
}
