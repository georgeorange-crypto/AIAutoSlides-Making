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
const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
