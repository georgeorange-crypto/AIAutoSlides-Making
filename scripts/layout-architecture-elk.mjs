#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2);
const arg=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1];};
const input=path.resolve(arg('input','examples/open-source-bakeoff/elkjs/architecture.json'));
const output=path.resolve(arg('out','outputs/open-source-bakeoff/elkjs/architecture-layout.json'));
const storyboardTemplate=path.resolve(arg('storyboard','examples/open-source-bakeoff/elkjs/storyboard.json'));
const storyboardOutput=path.resolve(arg('storyboard-out','outputs/open-source-bakeoff/elkjs/storyboard.json'));
const elkEntry=path.join(root,'outputs/open-source-bakeoff/elkjs-lab/node_modules/elkjs/lib/elk.bundled.js');
if(!fs.existsSync(elkEntry))throw new Error(`ELK.js is not installed in the isolated POC environment: ${elkEntry}`);
const require=createRequire(import.meta.url);
const ELK=require(elkEntry);
const elk=new ELK();
const diagram=JSON.parse(fs.readFileSync(input,'utf8'));
if(diagram.status!=='SYNTHETIC / HYPOTHETICAL')throw new Error('POC accepts only explicitly synthetic fixture data');
if(!Array.isArray(diagram.nodes)||diagram.nodes.length<2||!Array.isArray(diagram.edges)||!Array.isArray(diagram.groups)||diagram.groups.length!==3)throw new Error('Input must contain nodes, edges, and exactly three display groups');

const graph={
  id:'synthetic-architecture',
  layoutOptions:{
    'elk.algorithm':'layered',
    'elk.direction':'RIGHT',
    'elk.spacing.nodeNode':'34',
    'elk.layered.spacing.nodeNodeBetweenLayers':'70',
    'elk.padding':'[top=8,left=8,bottom=8,right=8]'
  },
  children:diagram.nodes.map(node=>({id:node.id,width:174,height:68})),
  edges:diagram.edges.map((edge,index)=>({id:`edge-${index+1}`,sources:[edge.from],targets:[edge.to]}))
};
const laidOut=await elk.layout(graph);
const sourceById=new Map(diagram.nodes.map(node=>[node.id,node]));
const bounds={minX:Math.min(...laidOut.children.map(node=>node.x)),minY:Math.min(...laidOut.children.map(node=>node.y)),maxX:Math.max(...laidOut.children.map(node=>node.x+node.width)),maxY:Math.max(...laidOut.children.map(node=>node.y+node.height))};
const area={x:1.02,y:3.05,w:11.25,h:2.65};
const scale=Math.min(area.w/(bounds.maxX-bounds.minX),area.h/(bounds.maxY-bounds.minY));
const nodes=laidOut.children.map(position=>{
  const source=sourceById.get(position.id);
  return {id:source.id,label:source.label,x:Number((area.x+(position.x-bounds.minX)*scale).toFixed(3)),y:Number((area.y+(position.y-bounds.minY)*scale).toFixed(3)),w:Number((position.width*scale).toFixed(3)),h:Number((position.height*scale).toFixed(3))};
});
const groupZones=[{x:0.85,w:3.0},{x:3.95,w:5.5},{x:9.55,w:2.95}];
const groups=diagram.groups.map((group,index)=>({label:group.label,...groupZones[index],y:2.55,h:3.7}));
const result={...diagram,groups,nodes,layout:{engine:'ELK.js',algorithm:'layered',direction:'RIGHT',elk_graph:{width:laidOut.width,height:laidOut.height},slide_area:area,scale:Number(scale.toFixed(4))}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const story=JSON.parse(fs.readFileSync(storyboardTemplate,'utf8'));
const diagramSlide=story.slides?.find(slide=>slide.type==='architecture');
if(!diagramSlide)throw new Error('Storyboard template must include an architecture slide');
diagramSlide.diagram=result;
fs.mkdirSync(path.dirname(storyboardOutput),{recursive:true});
fs.writeFileSync(storyboardOutput,JSON.stringify(story,null,2)+'\n');
console.log(JSON.stringify({elk_version:require(path.join(root,'outputs/open-source-bakeoff/elkjs-lab/node_modules/elkjs/package.json')).version,input:path.relative(root,input),output:path.relative(root,output),storyboard_output:path.relative(root,storyboardOutput),node_count:nodes.length,edge_count:result.edges.length,graph_bounds:{width:laidOut.width,height:laidOut.height},slide_area:area},null,2));
