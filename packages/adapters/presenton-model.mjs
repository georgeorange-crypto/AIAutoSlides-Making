import fs from 'node:fs';
import crypto from 'node:crypto';

export const PRESENTON_LOCAL_MODEL=Object.freeze({
  id:'qwen2.5-1.5b-instruct-q4_k_m',
  ollamaName:'ai4slides-qwen2.5-1.5b-instruct',
  repo:'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
  revision:'dd26da440ef0330c47919d1ecae0966d24022222',
  filename:'qwen2.5-1.5b-instruct-q4_k_m.gguf',
  bytes:1117320736,
  sha256:'6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
  license:'Apache-2.0'
});

export async function verifyModelArtifact(file,{bytes=PRESENTON_LOCAL_MODEL.bytes,sha256=PRESENTON_LOCAL_MODEL.sha256}={}){
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size!==bytes)throw new Error(`Local model artifact has ${stat.size} bytes; expected ${bytes}.`);
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  const digest=hash.digest('hex');
  if(digest!==sha256)throw new Error(`Local model artifact SHA-256 mismatch: expected ${sha256}, got ${digest}.`);
  return {bytes:stat.size,sha256:digest};
}
