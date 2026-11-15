import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,shortestPath,itinerary,edgeCost} from '../engine.mjs';
test('nominal itinerary visits both stops and returns with reserve in both sectors',()=>{
  for(const sector of ['jezero','gale']){const r=calculate({sector});assert.ok(r.viable);assert.ok(r.nominalViable);assert.ok(r.path.includes('wildcat'));assert.ok(r.path.includes('skinner'));assert.equal(r.path.at(-1),'base');assert.ok(r.reserve>=20);}
});
test('reduced mobility removes close observation and proposes a pending visual alternative',()=>{
  const r=calculate({event:true,current:'wildcat',elapsed:24});assert.equal(r.nominalViable,false);assert.equal(r.alternative,true);assert.deepEqual(r.stops,['lookout']);assert.ok(r.reserve>=20);assert.equal(r.sciencePending,true);
});
test('Gale closure excludes the blocked ridge and preserves a valid return',()=>{
  const r=calculate({sector:'gale',event:true,current:'wildcat',elapsed:24});assert.equal(r.nominalViable,false);assert.ok(!r.path.includes('skinner'));assert.ok(!r.reachable.includes('skinner'));assert.equal(r.path.at(-1),'base');assert.ok(r.reserve>=20);
});
test('poor visibility invalidates visual substitution',()=>{
  const r=calculate({event:true,dust:true,current:'wildcat',elapsed:24});assert.equal(r.alternative,false);assert.deepEqual(r.stops,[]);assert.equal(r.path.at(-1),'base');
});
test('insufficient budget reports no viable return',()=>{const r=calculate({event:true,current:'wildcat',elapsed:24,budget:35});assert.equal(r.viable,false);assert.ok(r.reserve<20);});
test('shortest paths are directional and cannot cross a closed destination',()=>{assert.ok(edgeCost('junction','wildcat')>edgeCost('wildcat','junction'));assert.equal(shortestPath('base','skinner',{blocked:['skinner']}).time,Infinity);});
test('every reachable node has outbound and home time within reserve',()=>{const r=calculate({event:true,current:'wildcat',elapsed:24});for(const id of r.reachable){const a=shortestPath('wildcat',id,{speed:r.speed}),b=shortestPath(id,'base',{speed:r.speed});assert.ok(120-24-a.time-b.time>=20);}});
test('empty itinerary is a return route and zero speed is rejected',()=>{assert.equal(itinerary('wildcat',[]).path.at(-1),'base');assert.equal(shortestPath('base','wildcat',{speed:0}).time,Infinity);});
test('approved alternative remains the only target until completed',()=>{
  const approved=calculate({event:true,current:'wildcat',elapsed:24,selected:['lookout']});
  assert.deepEqual(approved.stops,['lookout']);assert.equal(approved.alternative,true);assert.equal(approved.sciencePending,true);
  const completed=calculate({event:true,current:'lookout',elapsed:50,selected:[]});
  assert.deepEqual(completed.stops,[]);assert.ok(!completed.path.includes('skinner'));assert.equal(completed.path.at(-1),'base');
});
test('each reachable segment permits traversing the full segment and returning',()=>{
  const r=calculate({event:true,current:'wildcat',elapsed:24});
  for(const [a,b] of r.reachableEdges){const traverse=(u,v)=>shortestPath('wildcat',u,{speed:r.speed}).time+edgeCost(u,v,r.speed)+shortestPath(v,'base',{speed:r.speed}).time;assert.ok(Math.min(traverse(a,b),traverse(b,a))+24+20<=120);}
});
test('visibility also invalidates an explicitly selected lookout',()=>{
  const r=calculate({event:true,current:'wildcat',elapsed:24,selected:['lookout'],dust:true});assert.deepEqual(r.stops,[]);assert.equal(r.alternative,false);
});
