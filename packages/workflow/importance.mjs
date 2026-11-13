const LEVELS=new Map([
  ['critical',{band:'priority',weight:2.4}],['essential',{band:'priority',weight:2.2}],['primary',{band:'priority',weight:2}],['core',{band:'priority',weight:2}],['high',{band:'priority',weight:1.8}],['key',{band:'priority',weight:1.8}],['important',{band:'priority',weight:1.8}],
  ['standard',{band:'standard',weight:1}],['normal',{band:'standard',weight:1}],['medium',{band:'standard',weight:1}],
  ['supporting',{band:'supporting',weight:0.65}],['secondary',{band:'supporting',weight:0.65}],['minor',{band:'supporting',weight:0.5}],['detail',{band:'supporting',weight:0.5}],['background',{band:'supporting',weight:0.5}],['optional',{band:'supporting',weight:0.4}],['low',{band:'supporting',weight:0.5}]
]);

export function classifyImportance(value){return LEVELS.get(String(value||'').trim().toLocaleLowerCase())?.band||null;}
export function importanceWeight(value){return LEVELS.get(String(value||'').trim().toLocaleLowerCase())?.weight??null;}
export function importanceLevels(){return [...LEVELS.keys()];}
