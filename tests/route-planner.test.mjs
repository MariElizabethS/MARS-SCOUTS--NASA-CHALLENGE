import test from 'node:test';
import assert from 'node:assert/strict';
import {routeOptions} from '../route-planner.mjs';
import {calculate,evaluatePath,sectors,nodeById,shortestPath} from '../engine.mjs';
import {hazards,segmentIntersectsHazard} from '../safety.mjs';
import {returnEcho} from '../echo.mjs';

test('three distinct colored corridor plans include the stops and recommend the fastest',()=>{
  const routes=routeOptions();
  assert.equal(routes.length,3);
  assert.equal(new Set(routes.map(route=>route.color)).size,3);
  const geometry=route=>route.path.slice(1).map((id,i)=>[id,route.path[i]].sort().join('-')).sort().join(',');
  assert.equal(new Set(routes.map(geometry)).size,3);
  assert.equal(routes.filter(route=>route.recommended).length,1);
  for(const route of routes){
    assert.ok(route.path.includes('wildcat')&&route.path.includes('skinner'));
    assert.ok(route.time>=routes[0].time);
    assert.ok(route.reserve>=20);
    assert.ok(route.reason.length&&route.encounterText.length);
    assert.equal(route.points.length,route.path.length);
  }
});

test('the selected alternative is honored by the engine instead of replaced with the shortest path',()=>{
  const route=routeOptions()[2],result=calculate({preferredPath:route.path,selected:route.stops});
  assert.deepEqual(result.path,route.path);
  assert.ok(Math.abs(result.time-route.time)<1e-9);
  assert.equal(evaluatePath(['base','skinner','base'],{stops:['skinner']}),null);
});

test('alternatives respect closures, low visibility, exhausted time and additional equipment',()=>{
  for(const route of routeOptions({sector:'gale',event:true}))assert.ok(!route.path.includes('skinner'));
  for(const route of routeOptions({sector:'jezero',event:true,dust:true}))assert.ok(!route.stops.includes('lookout'));
  assert.deepEqual(routeOptions({budget:10,minReserve:20}),[]);
  const loaded=routeOptions({extraLoadKg:20,budget:200});
  assert.equal(loaded[0].stops.length,2);
  const result=calculate({extraLoadKg:20,budget:200,preferredPath:loaded[0].path});
  assert.ok(Math.abs(result.speed-45/1.4)<1e-9);
  assert.ok(Math.abs(result.time-loaded[0].time)<1e-9);
});

test('replanning between nodes preserves the real anchor in all returned alternatives',()=>{
  const anchor={from:'base',to:'junction',fraction:.4};
  const routes=routeOptions({current:'crew',anchor,elapsed:3});
  assert.ok(routes.length>0);
  for(const route of routes){
    assert.equal(route.path[0],'crew');
    assert.ok(Math.abs(route.points[0][0]-214)<1e-9);
    assert.ok(evaluatePath(route.path,{current:'crew',anchor,stops:route.stops,stopData:sectors.jezero.stops}));
  }
});

test('return preview follows the chosen outbound corridor while preserving live state',()=>{
  const southern=routeOptions({selected:['wildcat']}).find(route=>route.path.includes('south'));
  const chosen=southern?{...southern,path:southern.path[1]==='south'?southern.path:[...southern.path].reverse()}:null;
  assert.ok(chosen);
  const options={selected:['wildcat'],preferredPath:chosen.path,current:'base'},before=JSON.stringify(options);
  const preview=returnEcho(options,1);
  assert.equal(preview.now.time,0);
  assert.deepEqual(preview.now.path,['base']);
  assert.equal(preview.anchor.from,'base');assert.equal(preview.anchor.to,'south');
  assert.equal(JSON.stringify(options),before);
});

test('hazard avoidance rejects a crossing even when both endpoint nodes are outside the circle',()=>{
  const zone=hazards.find(zone=>zone.id==='steep-slope');
  for(const id of ['crossing','skinner'])assert.ok(Math.hypot(nodeById(id).x-zone.x,nodeById(id).y-zone.y)*10>zone.radiusM);
  assert.equal(segmentIntersectsHazard(nodeById('crossing'),nodeById('skinner'),zone),true);
  assert.equal(shortestPath('wildcat','skinner',{avoidZones:[zone]}).time,Infinity);
  assert.equal(evaluatePath(calculate().path,{avoidZones:[zone]}),null);
});

test('safer plans retain accessible observations and explicitly name the stop they must omit',()=>{
  for(const sector of ['jezero','gale']){
    const routes=routeOptions({sector,avoidedHazards:hazards.map(zone=>zone.id)});
    assert.ok(routes.length>0);
    for(const route of routes){
      assert.deepEqual(route.stops,['wildcat']);
      assert.match(route.scope,new RegExp(sectors[sector].stops.skinner.name));
      assert.match(route.scope,/Not included in this safer plan/);
      for(let i=1;i<route.path.length;i++)for(const zone of hazards)assert.equal(segmentIntersectsHazard(nodeById(route.path[i-1]),nodeById(route.path[i]),zone),false);
      const selected=calculate({sector,selected:route.stops,preferredPath:route.path,avoidedHazards:hazards.map(zone=>zone.id)});
      assert.deepEqual(selected.path,route.path);assert.ok(selected.viable);assert.ok(selected.reserve>=20);
    }
  }
});

test('mid-corridor avoidance can retreat from the actual position without crossing the danger ahead',()=>{
  const anchor={from:'crossing',to:'skinner',fraction:.05};
  const routes=routeOptions({current:'crew',anchor,selected:['skinner'],avoidedHazards:['steep-slope']});
  assert.ok(routes.length>0);
  for(const route of routes){
    assert.equal(route.path[0],'crew');assert.equal(route.path[1],'crossing');
    assert.equal(route.path.at(-1),'base');assert.ok(!route.stops.includes('skinner'));
    for(let i=1;i<route.path.length;i++)assert.equal(segmentIntersectsHazard(nodeById(route.path[i-1],anchor),nodeById(route.path[i],anchor),hazards[1]),false);
  }
  assert.deepEqual(routeOptions({current:'crew',anchor:{...anchor,fraction:.25},avoidedHazards:['steep-slope']}),[]);
  assert.deepEqual(routeOptions({budget:5,avoidedHazards:['steep-slope']}),[]);
});

test('return preview respects the same excluded danger zones as the selected route',()=>{
  const options={current:'crossing',selected:[],avoidedHazards:['steep-slope']};
  const preview=returnEcho(options,3);
  for(const plan of [preview.now,preview.later])for(let i=1;i<plan.path.length;i++)assert.equal(segmentIntersectsHazard(nodeById(plan.path[i-1],preview.anchor),nodeById(plan.path[i],preview.anchor),hazards[1]),false);
});
