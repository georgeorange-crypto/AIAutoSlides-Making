const GENERIC_LABELS=new Set(['a','b','c','node','box','step','component','module','system','input','output','source','target']);
const GENERIC_LABEL_PATTERN=/^(?:node|box|step|component|module|system|input|output|source|target)(?:\s*#?\s*[a-z0-9]+)?$|^(?:节点|方框|步骤|组件|模块|系统|输入|输出|来源|目标)(?:[a-z0-9]|[一二三四五六七八九十]+)?$/u;
const ACTION_RELATION=/\b(?:call|invoke|read|write|store|load|route|forward|send|receive|return|compute|transform|validate|select|emit|update|map|query|publish|subscribe|control|schedule|dispatch|retrieve|compress|decompress|aggregate|produce|consume|handle|persist|execute|filter|merge|split|queue|enqueue|dequeue|assign|resolve|authorize|authenticate|connect|trigger|request|respond|depend|use|support|link)(?:s|es|ed|ing)?\b|\bdepends\s+on\b|\bresponds?\s+to\b|\bwaits?\s+for\b|\bconnects?\s+to\b|调用|路由|转发|发送|接收|返回|计算|转换|校验|验证|选择|发出|更新|映射|查询|发布|订阅|控制|调度|分发|检索|压缩|解压|聚合|产生|消费|处理|持久化|执行|过滤|合并|拆分|排队|入队|出队|分配|解析|授权|认证|缓存|写入|读取|存储|加载|连接|触发|依赖|响应|进入|离开|提供|获取|建立|销毁|注册|注销|等待|唤醒/u;

/** Lightweight structural/lexical checks. They do not establish that an architecture matches the real system. */
export function auditArchitectureGraph(nodes,edges,groups=[]){
  const issues=[];
  if(!Array.isArray(nodes)||nodes.length<3)issues.push('architecture needs at least 3 named nodes so it explains a system path rather than a two-box link');
  if(!Array.isArray(edges)||edges.length<2)issues.push('architecture needs at least 2 labeled relationships so it explains more than one connection');
  const list=Array.isArray(nodes)?nodes:[],edgeList=Array.isArray(edges)?edges:[],ids=new Set(list.map(node=>node?.id).filter(value=>typeof value==='string'));
  for(const [index,node] of list.entries()){
    const label=String(node?.label||'').trim(),length=[...label].length;
    const normalized=label.toLocaleLowerCase();if(length<3||GENERIC_LABELS.has(normalized)||GENERIC_LABEL_PATTERN.test(normalized))issues.push(`node ${index+1} label '${label}' is too short or generic; name the concrete service, component, or data object`);
  }
  const adjacency=new Map([...ids].map(id=>[id,new Set()])),outgoing=new Map([...ids].map(id=>[id,new Set()])),incoming=new Map([...ids].map(id=>[id,new Set()])),seenEdges=new Set();
  for(const [index,edge] of edgeList.entries()){
    const label=String(edge?.label||'').trim(),length=[...label].length,wordCount=(label.match(/[\p{L}\p{N}]+/gu)||[]).length,hasAction=ACTION_RELATION.test(label);
    if(length<3||length>32||!hasAction||(wordCount<2&& !/[\u3400-\u9fff]/u.test(label)))issues.push(`edge ${index+1} label '${label}' must briefly state an action relationship, such as 'routes the request' or '调度任务'`);
    if(ids.has(edge?.from)&&ids.has(edge?.to)&&edge.from!==edge.to){const pair=`${edge.from}\u0000${edge.to}`;if(seenEdges.has(pair))issues.push(`edge ${index+1} repeats the directed ${edge.from} → ${edge.to} connection; combine its meaning into one labeled relationship`);seenEdges.add(pair);adjacency.get(edge.from).add(edge.to);adjacency.get(edge.to).add(edge.from);outgoing.get(edge.from).add(edge.to);incoming.get(edge.to).add(edge.from);}
  }
  if(list.length>=2&&ids.size===list.length&&edgeList.length){const seen=new Set(),queue=[list[0]?.id];while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);for(const next of adjacency.get(id)||[])if(!seen.has(next))queue.push(next);}if(seen.size!==list.length)issues.push(`architecture graph is disconnected; ${list.length-seen.size} node(s) do not connect to the main system path`);}
  if(list.length>=3&&ids.size===list.length&&edgeList.length){
    const entries=[...ids].filter(id=>incoming.get(id)?.size===0),exits=[...ids].filter(id=>outgoing.get(id)?.size===0);
    if(!entries.length)issues.push('architecture needs an explicit entry component with no incoming relationship');
    if(!exits.length)issues.push('architecture needs an explicit output component with no outgoing relationship');
    const walk=(starts,graph)=>{const visited=new Set(),queue=[...starts];while(queue.length){const id=queue.shift();if(visited.has(id))continue;visited.add(id);for(const next of graph.get(id)||[])if(!visited.has(next))queue.push(next);}return visited;};
    const fromEntry=walk(entries,outgoing),toExit=walk(exits,incoming),offPath=[...ids].filter(id=>!fromEntry.has(id)||!toExit.has(id));
    if(offPath.length)issues.push(`architecture contains ${offPath.length} node(s) that are not on a directed entry-to-output path`);
  }
  if(list.length&&list.every(node=>[node?.x,node?.y,node?.w,node?.h].every(Number.isFinite))&&layoutArchitectureEdgeLabels(list,edgeList,groups)===null)issues.push('architecture relationship labels cannot fit without overlapping component or group labels; reposition nodes or simplify the diagram');
  return issues;
}

/** Place editable edge labels near their relationships without colliding with node or group labels. */
export function layoutArchitectureEdgeLabels(nodes,edges,groups=[]){
  if(!Array.isArray(nodes)||!Array.isArray(edges)||nodes.some(node=>![node?.x,node?.y,node?.w,node?.h].every(Number.isFinite)))return null;
  const byId=new Map(nodes.map(node=>[node.id,node])),width=1.8,height=0.34,gap=0.05,obstacles=[...nodes.map(node=>({x:node.x,y:node.y,w:node.w,h:node.h})),...(groups||[]).filter(group=>[group?.x,group?.y,group?.w,group?.h].every(Number.isFinite)).map(group=>({x:group.x+0.16,y:group.y+0.08,w:Math.max(0,group.w-0.32),h:0.34}))],placed=[];
  const overlaps=(a,b)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
  const result=[];
  for(const [index,edge] of edges.entries()){
    const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)return null;
    const midX=(from.x+from.w/2+to.x+to.w/2)/2,midY=(from.y+from.h/2+to.y+to.h/2)/2,candidates=[];
    for(let y=2.35;y<=6.49;y+=0.08)for(let x=0.55;x<=10.97;x+=0.12){const box={x:Number(x.toFixed(2)),y:Number(y.toFixed(2)),w:width,h:height};if(box.x+width>12.78||box.y+height>6.85||obstacles.some(item=>overlaps(box,item))||placed.some(item=>overlaps(box,item)))continue;const dx=box.x+width/2-midX,dy=box.y+height/2-midY,score=Math.hypot(dx,dy)+(Math.abs(dy)<0.25?0.18:0);candidates.push({box,score});}
    candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)return null;
    const box={...candidates[0].box,edge_index:index};placed.push(box);result.push(box);
  }
  return result;
}
