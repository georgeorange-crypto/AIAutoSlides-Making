import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function pythonCommand(){
 const candidates=process.platform==='win32'?[['py',['-3.12']],['python',[]]]:[['python3',[]],['python',[]]];
 for(const [exe,prefix] of candidates){const probe=spawnSync(exe,[...prefix,'--version'],{cwd:root,encoding:'utf8',windowsHide:true});if(!probe.error&&probe.status===0)return{exe,prefix};}
 return null;
}

test('research crawler worker rejects private DNS and cross-origin browser requests',t=>{
 const python=pythonCommand();if(!python){t.skip('Python is not installed');return;}
 const result=spawnSync(python.exe,[...python.prefix,'-m','unittest','discover','-s','workers/research','-p','test_worker_policy.py','-v'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);assert.match(result.stderr,/Ran 3 tests/);
});
