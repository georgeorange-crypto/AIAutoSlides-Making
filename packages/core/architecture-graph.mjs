const GENERIC_LABELS=new Set(['a','b','c','node','box','step','component','module','system','input','output','source','target']);
const GENERIC_LABEL_PATTERN=/^(?:node|box|step|component|module|system|input|output|source|target)(?:\s*#?\s*[a-z0-9]+)?$|^(?:节点|方框|步骤|组件|模块|系统|输入|输出|来源|目标)(?:[a-z0-9]|[一二三四五六七八九十]+)?$/u;
const ACTION_RELATION=/\b(?:call|invoke|read|write|store|load|route|forward|send|receive|return|compute|transform|validate|select|emit|update|map|query|publish|subscribe|control|schedule|dispatch|retrieve|compress|decompress|aggregate|produce|consume|handle|persist|execute|filter|merge|split|queue|enqueue|dequeue|assign|resolve|authorize|authenticate|connect|trigger|request|respond|depend|use|support|link)(?:s|es|ed|ing)?\b|\bdepends\s+on\b|\bresponds?\s+to\b|\bwaits?\s+for\b|\bconnects?\s+to\b|调用|路由|转发|发送|接收|返回|计算|转换|校验|验证|选择|发出|更新|映射|查询|发布|订阅|控制|调度|分发|检索|压缩|解压|聚合|产生|消费|处理|持久化|执行|过滤|合并|拆分|排队|入队|出队|分配|解析|授权|认证|缓存|写入|读取|存储|加载|连接|触发|依赖|响应|进入|离开|提供|获取|建立|销毁|注册|注销|等待|唤醒/u;

/** Lightweight structural/lexical checks. They do not establish that an architecture matches the real system. */
export function auditArchitectureGraph(nodes,edges){
  const issues=[];
  if(!Array.isArray(nodes)||nodes.length<2)issues.push('architecture needs at least 2 named nodes');
  if(!Array.isArray(edges)||edges.length<1)issues.push('architecture needs at least 1 labeled relationship');
  const list=Array.isArray(nodes)?nodes:[],edgeList=Array.isArray(edges)?edges:[],ids=new Set(list.map(node=>node?.id).filter(value=>typeof value==='string'));
  for(const [index,node] of list.entries()){
    const label=String(node?.label||'').trim(),length=[...label].length;
    const normalized=label.toLocaleLowerCase();if(length<3||GENERIC_LABELS.has(normalized)||GENERIC_LABEL_PATTERN.test(normalized))issues.push(`node ${index+1} label '${label}' is too short or generic; name the concrete service, component, or data object`);
  }
  const adjacency=new Map([...ids].map(id=>[id,new Set()]));
  for(const [index,edge] of edgeList.entries()){
    const label=String(edge?.label||'').trim(),length=[...label].length,wordCount=(label.match(/[\p{L}\p{N}]+/gu)||[]).length,hasAction=ACTION_RELATION.test(label);
    if(length<3||length>32||!hasAction||(wordCount<2&& !/[\u3400-\u9fff]/u.test(label)))issues.push(`edge ${index+1} label '${label}' must briefly state an action relationship, such as 'routes the request' or '调度任务'`);
    if(ids.has(edge?.from)&&ids.has(edge?.to)&&edge.from!==edge.to){adjacency.get(edge.from).add(edge.to);adjacency.get(edge.to).add(edge.from);}
  }
  if(list.length>=2&&ids.size===list.length&&edgeList.length){const seen=new Set(),queue=[list[0]?.id];while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);for(const next of adjacency.get(id)||[])if(!seen.has(next))queue.push(next);}if(seen.size!==list.length)issues.push(`architecture graph is disconnected; ${list.length-seen.size} node(s) do not connect to the main system path`);}
  return issues;
}
