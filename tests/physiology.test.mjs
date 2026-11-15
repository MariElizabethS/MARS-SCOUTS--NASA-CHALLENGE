import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPhysiology,advancePhysiology} from '../physiology.mjs';
import {ProximityMonitor} from '../safety.mjs';

test('walking increases modeled effort, heart rate and respiratory rate',()=>{
  const start=initialPhysiology(),walk=advancePhysiology(start,{dtMin:2,walking:true,speedMMin:45});
  assert.ok(walk.effort>0);assert.ok(walk.heartRate>start.heartRate);assert.ok(walk.respiratoryRate>start.respiratoryRate);assert.equal(start.timeMin,0);
});
test('uphill grade and roughness increase modeled workload at the same speed',()=>{
  const start=initialPhysiology(),flat=advancePhysiology(start,{dtMin:3,walking:true,speedMMin:35,slope:0,roughness:.1}),uphill=advancePhysiology(start,{dtMin:3,walking:true,speedMMin:35,slope:.1,roughness:.7});
  assert.ok(uphill.effort>flat.effort);assert.ok(uphill.heartRate>flat.heartRate);assert.ok(uphill.fatigue>flat.fatigue);
});
test('two minutes of rest decreases modeled heart rate, respiration and fatigue',()=>{
  let walk=initialPhysiology();for(let i=0;i<10;i++)walk=advancePhysiology(walk,{dtMin:1,walking:true,speedMMin:45,slope:.06});
  const rest=advancePhysiology(walk,{dtMin:2});assert.ok(rest.heartRate<walk.heartRate);assert.ok(rest.respiratoryRate<walk.respiratoryRate);assert.ok(rest.fatigue<walk.fatigue);assert.equal(rest.effort,0);assert.equal(rest.timeMin,walk.timeMin+2);
});
test('slower walking reduces modeled effort without deriving a diagnosis',()=>{
  const a=advancePhysiology(initialPhysiology(),{dtMin:2,walking:true,speedMMin:45}),b=advancePhysiology(initialPhysiology(),{dtMin:2,walking:true,speedMMin:14});assert.ok(b.effort<a.effort);assert.ok(b.heartRate<a.heartRate);assert.equal('diagnosis' in b,false);
});
test('workload replay is deterministic, finite and keeps a bounded history',()=>{
  const replay=()=>{let p=initialPhysiology();for(let i=0;i<200;i++)p=advancePhysiology(p,{dtMin:.2,walking:i%10!==0,speedMMin:40,slope:.05});return p;};
  const a=replay();assert.deepEqual(a,replay());assert.equal(a.history.length,40);for(const key of ['heartRate','respiratoryRate','spo2','effort','fatigue'])assert.ok(Number.isFinite(a[key]));assert.ok(a.spo2>=97.5&&a.spo2<=98.5);
});
test('invalid time does not alter the physiological state and invalid workload inputs remain finite',()=>{
  const p=initialPhysiology();assert.deepEqual(advancePhysiology(p,{dtMin:NaN}),p);assert.deepEqual(advancePhysiology(p,{dtMin:-2}),p);const r=advancePhysiology(p,{dtMin:1,walking:true,speedMMin:NaN,slope:Infinity,roughness:NaN});assert.ok(Number.isFinite(r.heartRate));
});
test('proximity monitor is silent outside hazards and does not repeat an active phase',()=>{
  const m=new ProximityMonitor();assert.deepEqual(m.update({x:15,y:77}),{active:[],events:[]});
  const first=m.update({x:70,y:55});assert.equal(first.events.length,1);assert.equal(first.events[0].phase,'near');
  for(let i=0;i<50;i++){const r=m.update({x:70,y:55});assert.equal(r.active.length,1);assert.equal(r.events.length,0);}
});
test('leaving clears the hazard and approaching again produces a fresh alert',()=>{
  const m=new ProximityMonitor(),first=m.update({x:70,y:55}).events[0];assert.equal(m.update({x:70,y:37}).events[0].phase,'inside');
  assert.deepEqual(m.update({x:15,y:77}),{active:[],events:[]});const second=m.update({x:70,y:55}).events[0];assert.notEqual(first.key,second.key);assert.equal(second.phase,'near');
  m.reset();assert.equal(m.update({x:70,y:55}).events.length,1);
});
