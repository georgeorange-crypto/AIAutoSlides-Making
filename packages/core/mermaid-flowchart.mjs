const NODE_ID=/^[A-Za-z0-9_][A-Za-z0-9_.:-]*/;
const OPERATORS=['-.->','==>','-->'];

function skipSpace(text,index){while(index<text.length&&/\s/.test(text[index]))index++;return index;}

function readNode(text,index,lineNumber){
  index=skipSpace(text,index);
  const idMatch=text.slice(index).match(NODE_ID);
  if(!idMatch)throw new Error(`line ${lineNumber}: expected a node ID`);
  const id=idMatch[0];index+=id.length;
  let label=id,shape='roundRect';
  const open=text[index],close=open==='['?']':open==='('?')':open==='{'?'}':null;
  if(close){
    const end=text.indexOf(close,index+1);
    if(end<0)throw new Error(`line ${lineNumber}: unclosed node label for '${id}'`);
    label=text.slice(index+1,end).trim();index=end+1;
    if(!label||label.length>65||/[<>\r\n]/.test(label))throw new Error(`line ${lineNumber}: node '${id}' label must be 1–65 plain-text characters`);
    shape=open==='['?'rect':open==='{'?'diamond':'roundRect';
  }
  return{node:{id,label,shape},index};
}

function setNode(nodes,node,lineNumber){
  const previous=nodes.get(node.id);
  if(previous&&((previous.label!==node.label&&previous.label!==node.id&&node.label!==node.id)||(previous.label===node.label&&previous.shape!==node.shape)))throw new Error(`line ${lineNumber}: node '${node.id}' has conflicting declarations`);
  if(!previous||previous.label===node.id&&node.label!==node.id)nodes.set(node.id,node);
}

function layout(nodes,edges,direction){
  const ids=[...nodes.keys()],incoming=new Map(ids.map(id=>[id,0])),outgoing=new Map(ids.map(id=>[id,[]]));
  for(const edge of edges){incoming.set(edge.to,incoming.get(edge.to)+1);outgoing.get(edge.from).push(edge.to);}
  const queue=ids.filter(id=>incoming.get(id)===0),rank=new Map(ids.map(id=>[id,0]));
  for(let cursor=0;cursor<queue.length;cursor++){
    const id=queue[cursor];
    for(const next of outgoing.get(id)){
      rank.set(next,Math.max(rank.get(next),rank.get(id)+1));
      incoming.set(next,incoming.get(next)-1);
      if(incoming.get(next)===0)queue.push(next);
    }
  }
  if(queue.length!==ids.length)throw new Error('native flowcharts require an acyclic directed graph; keep cyclic Mermaid source as editable text');
  const maxRank=Math.max(...rank.values()),rankCount=maxRank+1;
  if(rankCount>4)throw new Error('native flowchart layout supports at most four layers; use an explicit diagram or keep the Mermaid source');
  const byRank=Array.from({length:rankCount},()=>[]);
  for(const id of ids)byRank[rank.get(id)].push(id);
  const maxPerRank=Math.max(...byRank.map(items=>items.length));
  if(maxPerRank>4)throw new Error('native flowchart layout supports at most four nodes per layer; use an explicit diagram or keep the Mermaid source');
  const group={label:`Mermaid flowchart (${direction})`,x:0.82,y:2.43,w:11.70,h:4.25},nodeW=2.55,nodeH=0.72,layerGapX=(group.w-nodeW)/(Math.max(1,rankCount-1)),layerGapY=(group.h-0.55-nodeH)/(Math.max(1,rankCount-1)),positions=new Map();
  for(const [layer,items] of byRank.entries()){
    const x0=rankCount===1?group.x+(group.w-nodeW)/2:group.x+layer*layerGapX;
    const gapY=items.length===1?0:(group.h-0.55-items.length*nodeH)/(items.length+1);
    items.forEach((id,index)=>{
      const horizontal=direction==='LR'||direction==='RL';
      const x=horizontal?(direction==='RL'?group.x+(rankCount-1-layer)*layerGapX:x0):group.x+(items.length===1?(group.w-nodeW)/2:(group.w-items.length*nodeW)/(items.length+1)*(index+1)+nodeW*index);
      const y=horizontal?group.y+0.48+gapY*(index+1)+nodeH*index:group.y+0.48+(direction==='BT'?rankCount-1-layer:layer)*layerGapY;
      positions.set(id,{...nodes.get(id),x,y,w:nodeW,h:nodeH});
    });
  }
  return{groups:[group],nodes:ids.map(id=>positions.get(id)),edges};
}

/** Convert a deliberately bounded Mermaid flowchart subset into editable diagram geometry. */
export function parseMermaidFlowchart(source){
  if(typeof source!=='string'||source.length>12000)throw new Error('Mermaid source must be a string of at most 12000 characters');
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).filter(line=>!line.startsWith('%%'));
  const header=lines.shift()?.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)$/i);
  if(!header)throw new Error('only flowchart/graph with TD, TB, BT, LR, or RL direction is supported');
  const direction=header[1].toUpperCase()==='TB'?'TD':header[1].toUpperCase(),nodes=new Map(),edges=[],edgeKeys=new Set();
  for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
    const lineNumber=lineIndex+2,line=lines[lineIndex].replace(/;$/,'');
    if(line.includes('%%')||/^subgraph\b|^end\s*$/i.test(line))throw new Error(`line ${lineNumber}: comments, subgraphs, and directives are outside the native subset`);
    let parsed=readNode(line,0,lineNumber);setNode(nodes,parsed.node,lineNumber);let cursor=parsed.index,hasEdge=false;
    while((cursor=skipSpace(line,cursor))<line.length){
      const operator=OPERATORS.find(item=>line.startsWith(item,cursor));
      if(!operator)throw new Error(`line ${lineNumber}: unsupported Mermaid syntax near '${line.slice(cursor)}'`);
      cursor+=operator.length;cursor=skipSpace(line,cursor);
      let label='';
      if(line[cursor]==='|'){
        const end=line.indexOf('|',cursor+1);
        if(end<0)throw new Error(`line ${lineNumber}: unclosed edge label`);
        label=line.slice(cursor+1,end).trim();cursor=end+1;
        if(!label||label.length>45||/[<>\r\n]/.test(label))throw new Error(`line ${lineNumber}: edge label must be 1–45 plain-text characters`);
      }
      const next=readNode(line,cursor,lineNumber);setNode(nodes,next.node,lineNumber);
      if(parsed.node.id===next.node.id)throw new Error(`line ${lineNumber}: self-loop edges are not supported`);
      const key=`${parsed.node.id}\0${next.node.id}\0${label}`;
      if(!edgeKeys.has(key)){edges.push({from:parsed.node.id,to:next.node.id,...(label?{label}:{})});edgeKeys.add(key);}
      parsed=next;cursor=next.index;hasEdge=true;
    }
    if(!hasEdge&&nodes.size>12)throw new Error('native flowcharts support at most 12 nodes');
  }
  if(nodes.size<2||nodes.size>12||!edges.length||edges.length>24)throw new Error('native flowcharts require 2–12 nodes and 1–24 directed edges');
  return{...layout(nodes,edges,direction),direction};
}
