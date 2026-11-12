const CODE_COLUMNS=88;

function preferredBreak(text,limit){
  for(let i=limit;i>Math.max(0,limit-20);i--)if(/\s|[,;.)\]}]/.test(text[i-1]))return i;
  return limit;
}

export function wrapCodeLine(text,limit=CODE_COLUMNS){
  if(!text.length)return [''];
  const parts=[];let remaining=text;
  while(remaining.length>limit){const cut=preferredBreak(remaining,limit);parts.push(remaining.slice(0,cut));remaining=remaining.slice(cut);}
  parts.push(remaining);return parts;
}

export function codeSegments(lines){
  return lines.flatMap((text,lineIndex)=>wrapCodeLine(text).map((value,partIndex)=>({line:lineIndex+1,part:partIndex+1,text:value})));
}

export const CODE_LANGUAGES=new Set(['bash','c','cpp','javascript','json','python','sql','typescript','yaml','plaintext']);
