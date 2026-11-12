const renderers=new Set(['auto','powerpoint','libreoffice']);
export function parsePreviewArgs(argv){
  const input=argv.find((value,index)=>!value.startsWith('--')&&argv[index-1]!=='--renderer')||'outputs/research-demo.pptx';
  const index=argv.indexOf('--renderer'),renderer=index<0?'auto':argv[index+1];
  if(!renderers.has(renderer))throw new Error('--renderer must be auto, powerpoint, or libreoffice');
  return{input,renderer};
}
export function rendererOrder(platform,renderer){
  if(renderer==='powerpoint')return platform==='win32'?['powerpoint']:[];
  if(renderer==='libreoffice')return['libreoffice'];
  return platform==='win32'?['powerpoint','libreoffice']:['libreoffice'];
}
