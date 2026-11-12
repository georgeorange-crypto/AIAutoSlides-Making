export function relativeLuminance(hex){
 if(typeof hex!=='string'||!/^[0-9A-Fa-f]{6}$/.test(hex))throw new Error(`Expected six-digit RGB color, got ${hex}`);
 const c=hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
export function contrastRatio(a,b){const x=relativeLuminance(a),y=relativeLuminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
export function auditThemeContrast(theme,minimum=4.5){
 const pairs=[];
 for(const bg of ['background','surface','surfaceAlt'])for(const fg of ['title','text','muted','accent','accent2','warning'])pairs.push({background:bg,foreground:fg,ratio:Number(contrastRatio(theme[bg],theme[fg]).toFixed(2))});
 return{minimumContrastRatio:Math.min(...pairs.map(p=>p.ratio)),pairsBelowMinimum:pairs.filter(p=>p.ratio<minimum),pairs};
}
