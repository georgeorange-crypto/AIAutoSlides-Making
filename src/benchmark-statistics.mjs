export function summarize(values) {
  if (!Array.isArray(values)||!values.length||values.some(x=>!Number.isFinite(x)||x<0)) throw new TypeError('Timing samples must be a non-empty array of finite non-negative numbers');
  const sorted=[...values].sort((a,b)=>a-b), quantile=(p)=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];
  return {n:sorted.length,min_ms:sorted[0],median_ms:sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,p90_ms:quantile(.9),max_ms:sorted.at(-1),mean_ms:sorted.reduce((a,b)=>a+b,0)/sorted.length};
}
