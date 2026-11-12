#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {prepareBlindReview,recordBlindRating,summarizeBlindRatings,unblindRatings} from './blind-review.mjs';

const args=process.argv.slice(2),value=name=>{const i=args.indexOf(`--${name}`);return i<0?null:args[i+1];},read=file=>JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
try{
  const command=args[0];let result;
  if(command==='prepare')result=prepareBlindReview({deckA:value('a'),deckB:value('b'),outDir:value('out')});
  else if(command==='score'){
    const manifest=read(value('manifest')),scores=read(value('scores')),rating=recordBlindRating({manifest,deckId:value('deck'),reviewerId:value('reviewer'),scores,note:value('note')||''});
    if(!value('out'))throw new Error('score requires an explicit --out path');const output=path.resolve(value('out'));fs.writeFileSync(output,JSON.stringify(rating,null,2)+'\n');result={output,rating};
  }else if(command==='summarize'){
    const output=path.resolve(value('out')||'blind-summary.json'),ratings=args.filter(x=>x.startsWith('--rating=')).map(x=>read(x.slice('--rating='.length)));
    result=summarizeBlindRatings(ratings);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');result={output,...result};
  }else if(command==='unblind'){
    const output=path.resolve(value('out')||'unblinded-summary.json'),ratings=args.filter(x=>x.startsWith('--rating=')).map(x=>read(x.slice('--rating='.length))),key=read(value('key'));
    result=unblindRatings({ratings,key});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');result={output,...result};
  }else throw new Error('Usage: node src/blind-review-cli.mjs prepare --a first.pptx --b second.pptx --out outputs/m4/blind | score --manifest blind-manifest.json --deck A|B --reviewer R1 --scores scores.json [--out rating.json] | summarize --rating=rating.json [--out summary.json] | unblind --key blind-key.json --rating=rating.json [--out summary.json]');
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(`[ERROR] ${error.message}`);process.exitCode=1;}
