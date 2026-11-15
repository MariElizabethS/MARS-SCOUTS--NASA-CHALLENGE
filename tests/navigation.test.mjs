import test from 'node:test';
import assert from 'node:assert/strict';
import {missedTurn,deviationRecovery,segmentPosition} from '../navigation.mjs';
import {calculate,nodeById,edgeDistance,edgeCost,evaluatePath} from '../engine.mjs';

test('a missed turn follows a real alternate corridor and accounts for its distance and time',()=>{
  const plan=calculate(),result=missedTurn({...plan,selected:plan.stops,sector:'jezero'});
  assert.ok(result);
  assert.equal(result.anchor.from,'base');assert.equal(result.anchor.to,'south');
  assert.ok(Math.abs(result.distanceM-50)<1e-9);
  assert.ok(Math.abs(result.travelMin-edgeCost('base','south')*result.anchor.fraction)<1e-9);
  const reroute=calculate({current:'crew',anchor:result.anchor,elapsed:result.travelMin});
  assert.ok(reroute.viable);assert.equal(reroute.path[0],'crew');
  assert.ok(evaluatePath(reroute.path,{current:'crew',anchor:result.anchor}));
});

test('a mid-edge missed turn first reaches the junction, preserving real travel geometry',()=>{
  const anchor={from:'base',to:'junction',fraction:.4};
  const path=['crew','junction','wildcat','crossing','skinner','crossing','lookout','south','base'];
  const result=missedTurn({path,current:'crew',anchor,speed:45});
  assert.equal(result.anchor.from,'junction');assert.equal(result.anchor.to,'lookout');
  assert.ok(Math.abs(result.distanceM-(edgeDistance('crew','junction',anchor)+50))<1e-9);
  const point=nodeById('crew',anchor);
  assert.deepEqual(result.track[0],[point.x*10,point.y*7.5]);
});

test('when side corridors are blocked the demo leaves the mapped line and requires retracing',()=>{
  const deviation=missedTurn({path:['base','junction','base'],blocked:['south','lookout','wildcat']});
  assert.equal(deviation.offCorridor,true);
  assert.equal(deviationRecovery({current:'base'},{offCorridor:true,segment:deviation.segments[0]}).kind,'return');
  assert.equal(missedTurn({path:['base']}),null);
});

test('a usable alternative continues forward and retains every remaining observation',()=>{
  const anchor={from:'base',to:'south',fraction:.2};
  const result=deviationRecovery({budget:140,selected:['wildcat','skinner'],speed:45},{anchor});
  assert.equal(result.kind,'alternative');
  for(const route of result.options){
    assert.equal(route.path[1],'south');assert.ok(route.stops.includes('wildcat')&&route.stops.includes('skinner'));
  }
});

test('a cul-de-sac requires returning instead of presenting a U-turn as an alternative',()=>{
  const anchor={from:'crossing',to:'skinner',fraction:.2};
  const result=deviationRecovery({budget:200,selected:['wildcat'],speed:45},{anchor});
  assert.equal(result.kind,'return');assert.equal(result.returnTo,'crossing');
  assert.equal(segmentPosition(result.segment,0).current,'crew');
  assert.equal(segmentPosition(result.segment,1).current,'crossing');
  assert.ok(Math.abs(result.segment.timeMin-edgeCost('skinner','crossing')*.2)<1e-9);
});

test('a fallback that drops requested observations is not offered as an alternative',()=>{
  const anchor={from:'base',to:'south',fraction:.2};
  const result=deviationRecovery({budget:65,selected:['wildcat','skinner'],speed:45},{anchor});
  assert.equal(result.kind,'return');
});
