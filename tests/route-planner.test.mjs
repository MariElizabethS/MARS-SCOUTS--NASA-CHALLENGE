import test from 'node:test';
import assert from 'node:assert/strict';
import {routeOptions} from '../route-planner.mjs';
import {calculate,evaluatePath,sectors} from '../engine.mjs';
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
