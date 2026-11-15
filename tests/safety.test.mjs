import test from 'node:test';
import assert from 'node:assert/strict';
import {proximityAlerts,NoticeGate,operationalMobility,hazards,hazardsFor} from '../safety.mjs';
import {calculate,anchorNode,nodeById,shortestPath,edgeDistance,edgeCost} from '../engine.mjs';

test('a proximity alert starts before entering the caution area',()=>{
  assert.equal(proximityAlerts({x:70,y:64}).some(z=>z.id==='steep-slope'),false);
  const near=proximityAlerts({x:70,y:62}).find(z=>z.id==='steep-slope');
  assert.equal(near.phase,'near');assert.equal(near.distanceM,175);assert.equal(near.critical,false);
  const inside=proximityAlerts({x:70,y:37}).find(z=>z.id==='steep-slope');assert.equal(inside.phase,'inside');assert.equal(inside.critical,false);
});
test('entering an excluded area is critical; approaching it is a warning',()=>{
  const zone=hazards.find(z=>z.kind==='exclusion');
  assert.equal(proximityAlerts({x:zone.x,y:zone.y}).find(z=>z.id===zone.id).critical,true);
  const near=proximityAlerts({x:zone.x+(zone.radiusM+50)/10,y:zone.y}).find(z=>z.id===zone.id);
  assert.equal(near.phase,'near');assert.equal(near.critical,false);
});
test('position without evidence does not produce a misleading proximity alert',()=>{
  assert.deepEqual(proximityAlerts(null),[]);assert.deepEqual(proximityAlerts({x:NaN,y:0}),[]);
});
test('notices are emitted once per phase and can be reset for a new walk',()=>{
  const gate=new NoticeGate();assert.equal(gate.take('slope-near'),true);
  for(let i=0;i<100;i++)assert.equal(gate.take('slope-near'),false);
  assert.equal(gate.take('slope-inside'),true);gate.reset();assert.equal(gate.take('slope-near'),true);
});
test('only the operational report and stale state affect mobility, not physiological readings',()=>{
  assert.equal(operationalMobility({profile:'nominal',pulse:180,spo2:70}),'nominal');
  assert.equal(operationalMobility({profile:'reduced'}),'reduced');
  assert.equal(operationalMobility({profile:'nominal',stale:true}),'reduced');
});
test('a request to slow down affects routes in both sectors without a terrain event',()=>{
  for(const sector of ['jezero','gale']){
    const normal=calculate({sector,budget:300,current:'wildcat',elapsed:24});
    const rest=calculate({sector,budget:300,current:'wildcat',elapsed:24,mobility:'reduced'});
    assert.equal(rest.speed,14);assert.ok(rest.time>normal.time);assert.ok(rest.reserve<normal.reserve);assert.equal(rest.blocked.length,0);
  }
});
test('splitting an edge at the astronaut position preserves path distance and time',()=>{
  const anchor={from:'base',to:'junction',fraction:.4},p=anchorNode(anchor);
  assert.ok(p);assert.equal(p.x,nodeById('base').x+(nodeById('junction').x-nodeById('base').x)*.4);
  const split=shortestPath('base','junction',{anchor});
  assert.deepEqual(split.path,['base','crew','junction']);
  assert.ok(Math.abs(split.distance-edgeDistance('base','junction'))<1e-8);
  assert.ok(Math.abs(split.time-edgeCost('base','junction'))<1e-8);
});
test('a pause mid-edge recalculates from the actual position, including partial return cost',()=>{
  const anchor={from:'base',to:'junction',fraction:.4};
  const r=calculate({current:'crew',anchor,selected:[],elapsed:3,mobility:'reduced'});
  assert.equal(r.path[0],'crew');assert.equal(r.path.at(-1),'base');
  assert.ok(Math.abs(r.distance-edgeDistance('base','junction')*.4)<1e-8);
  assert.equal(r.reserve,120-3-r.time);assert.equal(r.speed,14);
});
test('an invalid anchor cannot invent a corridor through unmapped terrain',()=>{
  assert.equal(anchorNode({from:'base',to:'skinner',fraction:.5}),null);
  assert.equal(shortestPath('crew','base',{anchor:{from:'base',to:'skinner',fraction:.5}}).time,Infinity);
});

test('every hazard explains the terrain risk, including a temporary ridge closure',()=>{
  for(const zone of hazardsFor({sector:'gale',event:true}))assert.ok(zone.name&&zone.description.length>30);
  assert.match(hazards[0].description,/loose rocks/i);
  assert.match(hazards[1].description,/slipping/i);
  assert.match(hazardsFor({sector:'gale',event:true}).at(-1).description,/closed/i);
});
