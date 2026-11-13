import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMermaidFlowchart} from '../packages/core/mermaid-flowchart.mjs';

test('bounded Mermaid flowcharts produce stable native-shape geometry and retain labels',()=>{
 const result=parseMermaidFlowchart('flowchart LR\n A[Input] -->|validated| B{Decision}\n B ==> C(Output)');
 assert.equal(result.direction,'LR');assert.deepEqual(result.nodes.map(node=>node.label),['Input','Decision','Output']);
 assert.deepEqual(result.nodes.map(node=>node.shape),['rect','diamond','roundRect']);
 assert.equal(result.edges[0].label,'validated');assert.equal(result.nodes[0].x<result.nodes[1].x,true);assert.equal(result.nodes[1].x<result.nodes[2].x,true);
 assert.ok(result.nodes.every(node=>node.x>=0&&node.y>=2.35&&node.x+node.w<=13.333&&node.y+node.h<=6.85));
});

test('Mermaid direction, comments, declaration merging and repeated edges are deterministic',()=>{
 const result=parseMermaidFlowchart('graph BT\n%% a line comment\nA --> B\nB[Explicit label] --> C\nA --> B');
 assert.equal(result.direction,'BT');assert.equal(result.nodes.find(node=>node.id==='B').label,'Explicit label');
 assert.equal(result.edges.length,2);assert.ok(result.nodes.find(node=>node.id==='A').y>result.nodes.find(node=>node.id==='C').y);
});

test('unsupported Mermaid syntax, cycles, conflicting nodes and excessive layouts fail closed',()=>{
 for(const source of [
  'flowchart TD\nA --> B\nB --> A',
  'flowchart TD\nA[One] --> B[Two]\nA[Different] --> C[Three]',
  'flowchart TD\nsubgraph X\nA --> B\nend',
  'flowchart TD\nA -->| | B',
  `flowchart TD\n${Array.from({length:5},(_,i)=>`N${i} --> N${i+1}`).join('\n')}`
 ])assert.throws(()=>parseMermaidFlowchart(source));
 assert.throws(()=>parseMermaidFlowchart('flowchart TD\nA --> B\nB --> C\nC --> D\nD --> E'),/at most four layers/);
 assert.throws(()=>parseMermaidFlowchart('flowchart TD\nA --> B\n'+Array.from({length:4},(_,i)=>`A --> X${i}`).join('\n')),/at most four nodes per layer/);
 assert.throws(()=>parseMermaidFlowchart('sequenceDiagram\nA->>B: hi'),/only flowchart/);
});
