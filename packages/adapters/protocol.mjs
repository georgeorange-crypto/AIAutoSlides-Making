/** Minimal, versioned contract for isolated tool adapters. */
export const TOOL_ADAPTER_API_VERSION = 1;

/** Compare a render request with a live adapter capability report before execution. */
export async function negotiateAdapterCapabilities(adapter,request={}){
  const probe=adapter?.probeCapabilities||adapter?.capabilities;
  if(typeof probe!=='function')throw new TypeError('Adapter must expose probeCapabilities() or capabilities()');
  const formats=request.formats??(request.format?[request.format]:[]),requirements=request.requirements??{};
  if(!Array.isArray(formats)||formats.length===0||formats.some(format=>typeof format!=='string'||!format))throw new TypeError('Requested formats must be a non-empty array of non-empty strings');
  if(!requirements||typeof requirements!=='object'||Array.isArray(requirements))throw new TypeError('Capability requirements must be an object');
  let actual;
  try{actual=await probe.call(adapter);}catch(error){return{ok:false,status:'blocked',adapter_id:adapter?.manifest?.id||null,formats:[],capabilities:null,reasons:[`Capability probe failed: ${error.message}`]};}
  const supportedFormats=Array.isArray(actual?.formats)?actual.formats:[],reasons=[];
  for(const format of formats)if(!supportedFormats.includes(format))reasons.push(`Unsupported output format '${format}'`);
  for(const [key,required] of Object.entries(requirements)){
    if(required===false||required===undefined||required===null)continue;
    const available=actual?.[key];
    if(typeof required==='boolean'){if(required&&available!==true)reasons.push(`Required capability '${key}' is unavailable`);}
    else if(Array.isArray(required)){const values=Array.isArray(available)?available:[];for(const value of required)if(!values.includes(value))reasons.push(`Required '${key}' value '${value}' is unavailable`);}
    else if(available!==required)reasons.push(`Required '${key}' value '${required}' is unavailable`);
  }
  return{ok:reasons.length===0,status:reasons.length?'unsupported':'supported',adapter_id:adapter?.manifest?.id||null,formats:formats.filter(format=>supportedFormats.includes(format)),capabilities:actual,reasons};
}

export function defineToolAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Adapter must be an object');
  const {manifest, doctor, probeCapabilities, run} = adapter;
  if (!manifest?.id || !manifest?.version || !manifest?.status) throw new TypeError('Adapter manifest requires id, version, and status');
  for (const [name, fn] of Object.entries({doctor, probeCapabilities, run})) {
    if (typeof fn !== 'function') throw new TypeError(`Adapter ${manifest.id} requires ${name}()`);
  }
  if(adapter.smokeTest!==undefined&&typeof adapter.smokeTest!=='function')throw new TypeError(`Adapter ${manifest.id} smokeTest must be a function`);
  const negotiate=adapter.negotiate||((request)=>negotiateAdapterCapabilities(adapter,request));
  return Object.freeze({...adapter,negotiate,apiVersion: TOOL_ADAPTER_API_VERSION});
}

export const PRESENTATION_ADAPTER_API_VERSION=1;

/** Versioned renderer contract; legacy tool hooks are generated for the local catalog CLI. */
export function definePresentationAdapter(adapter){
  if(!adapter||typeof adapter!=='object')throw new TypeError('Presentation adapter must be an object');
  const {manifest,probe,capabilities,render,edit,export:exportArtifacts,cancel}=adapter;
  if(!manifest?.id||!manifest?.version||!manifest?.kind||!manifest?.status)throw new TypeError('Presentation adapter manifest requires id, version, kind, and status');
  for(const field of ['capabilities','platforms','inputs','outputs'])if(!Array.isArray(manifest[field])||!manifest[field].length)throw new TypeError(`Presentation adapter ${manifest.id} manifest requires ${field}[]`);
  if(typeof manifest.needsNetwork!=='boolean'||typeof manifest.needsAuth!=='boolean')throw new TypeError(`Presentation adapter ${manifest.id} manifest requires needsNetwork and needsAuth flags`);
  for(const [name,fn] of Object.entries({probe,capabilities,render}))if(typeof fn!=='function')throw new TypeError(`Presentation adapter ${manifest.id} requires ${name}()`);
  for(const [name,fn] of Object.entries({edit,export:exportArtifacts,cancel}))if(fn!==undefined&&typeof fn!=='function')throw new TypeError(`Presentation adapter ${manifest.id} optional ${name} must be a function when supplied`);
  const doctor=adapter.doctor||(async()=>{const result=await probe();return{ok:result.status==='available',...result,warnings:[]};});
  const probeCapabilities=adapter.probeCapabilities||capabilities;
  const run=adapter.run||render;
  const negotiate=adapter.negotiate||((request)=>negotiateAdapterCapabilities({...adapter,probeCapabilities},request));
  return Object.freeze({...adapter,doctor,probeCapabilities,run,negotiate,apiVersion:PRESENTATION_ADAPTER_API_VERSION});
}
