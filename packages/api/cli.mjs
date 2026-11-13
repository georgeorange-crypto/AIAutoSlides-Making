#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLocalApi} from './server.mjs';

function options(args){const result={port:8787,workspace:path.resolve('workspace'),enableLocalPdfOcr:false,pdfOcrLanguage:'eng'};for(let i=0;i<args.length;i++){if(args[i]==='--port'){const value=Number(args[++i]);if(!Number.isInteger(value)||value<0||value>65535)throw new Error('--port must be an integer from 0 to 65535.');result.port=value;}else if(args[i]==='--workspace'){const value=args[++i];if(!value)throw new Error('--workspace requires a directory.');result.workspace=path.resolve(value);}else if(args[i]==='--enable-local-pdf-ocr')result.enableLocalPdfOcr=true;else if(args[i]==='--pdf-ocr-lang'){const value=args[++i];if(!['eng','chi_sim','eng+chi_sim'].includes(value))throw new Error('--pdf-ocr-lang must be eng, chi_sim, or eng+chi_sim.');result.pdfOcrLanguage=value;}else if(args[i]==='--help'){result.help=true;}else throw new Error(`Unknown option '${args[i]}'.`);}return result;}

export async function main(args=process.argv.slice(2)){
  const config=options(args);if(config.help){console.log('Usage: npm run api -- [--workspace <directory>] [--port 8787] [--enable-local-pdf-ocr [--pdf-ocr-lang eng|chi_sim|eng+chi_sim]]');return;}
  const api=await createLocalApi({workspaceDir:config.workspace,enableLocalPdfOcr:config.enableLocalPdfOcr,pdfOcrLanguage:config.pdfOcrLanguage});const address=await api.listen({port:config.port});
  console.log(`Local API listening at http://127.0.0.1:${address.port}; workspace: ${config.workspace}`);
  const shutdown=async()=>{await api.close();process.exit(0);};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(`API startup failed: ${error.message}`);process.exitCode=1;});
