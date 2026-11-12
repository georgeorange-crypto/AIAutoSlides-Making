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

const LANCZOS=[676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.507343278686905,-0.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
function logGamma(z){if(z<0.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);z-=1;let x=0.9999999999998099;for(let i=0;i<LANCZOS.length;i++)x+=LANCZOS[i]/(z+i+1);const t=z+LANCZOS.length-0.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);}
function betaFraction(a,b,x){const qab=a+b,qap=a+1,qam=a-1;let c=1,d=1-qab*x/qap;if(Math.abs(d)<1e-30)d=1e-30;d=1/d;let h=d;for(let m=1;m<=200;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-14)break;}return h;}
function regularizedBeta(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));return x<(a+1)/(a+b+2)?bt*betaFraction(a,b,x)/a:1-bt*betaFraction(b,a,1-x)/b;}
function studentTCdf(t,df){if(t===0)return 0.5;const x=df/(df+t*t),tail=0.5*regularizedBeta(x,df/2,0.5);return t>0?1-tail:tail;}
function studentTQuantile(p,df){let lo=0,hi=1;while(studentTCdf(hi,df)<p)hi*=2;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(studentTCdf(mid,df)<p)lo=mid;else hi=mid;}return(lo+hi)/2;}
export function studentTMeanInterval(values,{confidence=0.95}={}){
  if(!Array.isArray(values)||values.length<10||values.some(v=>!Number.isFinite(v)))throw new Error('Student-t mean interval requires at least 10 finite independent run values');
  if(!(confidence>0&&confidence<1))throw new Error('Confidence level must be between 0 and 1');
  const mean=values.reduce((a,b)=>a+b,0)/values.length,variance=values.reduce((sum,v)=>sum+(v-mean)**2,0)/(values.length-1),halfWidth=studentTQuantile((1+confidence)/2,values.length-1)*Math.sqrt(variance/values.length);
  return {mean,lower:mean-halfWidth,upper:mean+halfWidth,error_minus:halfWidth,error_plus:halfWidth,n:values.length,confidence_level:confidence,method:'two-sided Student-t confidence interval for the mean; assumes independent, approximately normal run-level values'};
}
