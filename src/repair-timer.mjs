import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const hashFile=file=>file?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null;
export function startRepairSession({sessionPath,deckPath,label='manual-edit',now=new Date()}={}){
 if(!sessionPath)throw new Error('--session is required');if(!label.trim())throw new Error('--label cannot be empty');
 if(fs.existsSync(sessionPath)){const old=JSON.parse(fs.readFileSync(sessionPath,'utf8'));if(old.status==='running')throw new Error('A repair timing session is already running in this file.');}
 const deck=deckPath?path.resolve(deckPath):null;if(deck&&!fs.existsSync(deck))throw new Error(`Deck not found: ${deck}`);
 const state={schema_version:1,status:'running',label,started_at:now.toISOString(),deck_sha256_before:hashFile(deck),deck_name:deck?path.basename(deck):null};
 fs.mkdirSync(path.dirname(path.resolve(sessionPath)),{recursive:true});fs.writeFileSync(sessionPath,JSON.stringify(state,null,2)+'\n');return state;
}
export function stopRepairSession({sessionPath,deckPath,edits,now=new Date()}={}){
 if(!sessionPath||!fs.existsSync(sessionPath))throw new Error('Running session not found; pass the same --session path used by start.');
 const state=JSON.parse(fs.readFileSync(sessionPath,'utf8'));if(state.status!=='running')throw new Error('This repair timing session has already been stopped.');
 const count=Number(edits);if(!Number.isInteger(count)||count<0)throw new Error('--edits must be a non-negative integer.');
 const deck=deckPath?path.resolve(deckPath):null;if(deck&&!fs.existsSync(deck))throw new Error(`Deck not found: ${deck}`);
 const seconds=(now.getTime()-new Date(state.started_at).getTime())/1000;if(seconds<0)throw new Error('Stop time is earlier than start time.');
 const result={...state,status:'complete',stopped_at:now.toISOString(),elapsed_seconds:Number(seconds.toFixed(3)),elapsed_minutes:Number((seconds/60).toFixed(3)),repair_count:count,deck_sha256_after:hashFile(deck),deck_changed:!!(state.deck_sha256_before&&deck&&state.deck_sha256_before!==hashFile(deck)),deck_name:deck?path.basename(deck):state.deck_name};
 fs.writeFileSync(sessionPath,JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=k=>{const i=args.indexOf(`--${k}`);return i<0?undefined:args[i+1];},sessionPath=value('session')||'outputs/m4/manual-repair-session.json';
 try{let result;if(args[0]==='start')result=startRepairSession({sessionPath,deckPath:value('deck'),label:value('label')||'manual-edit'});else if(args[0]==='stop')result=stopRepairSession({sessionPath,deckPath:value('deck'),edits:value('edits')});else throw new Error('Usage: node src/repair-timer.mjs <start|stop> --session <file> [--deck <pptx>] [--label <name>] [--edits <count>]');console.log(JSON.stringify(result,null,2));}catch(e){console.error(`[ERROR] ${e.message}`);process.exitCode=1;}
}
