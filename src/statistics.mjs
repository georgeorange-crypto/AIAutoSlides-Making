export function empiricalCdfStep(observations){
  if(!Array.isArray(observations)||observations.length<2||observations.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('Empirical CDF needs at least two finite raw observations');
  const sorted=[...observations].sort((a,b)=>a-b),x_values=[],values=[];
  let cumulative=0;
  for(let i=0;i<sorted.length;){
    const value=sorted[i];let end=i+1;while(end<sorted.length&&sorted[end]===value)end++;
    x_values.push(value,value);
    values.push(cumulative/sorted.length,end/sorted.length);
    cumulative=end;i=end;
  }
  return{x_values,values};
}
