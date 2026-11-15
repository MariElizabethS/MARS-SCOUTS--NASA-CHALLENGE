import test from 'node:test';
import assert from 'node:assert/strict';
import {carriedLoad,scenarioWeather} from '../conditions.mjs';
import {calculate} from '../engine.mjs';
import {returnEcho} from '../echo.mjs';

test('extra equipment increases travel time without changing the route or observation durations',()=>{
  const unloaded=calculate({budget:300}),loaded=calculate({budget:300,extraLoadKg:20,preferredPath:unloaded.path});
  assert.deepEqual(loaded.path,unloaded.path);
  assert.equal(loaded.distance,unloaded.distance);
  assert.ok(Math.abs(loaded.speed-45/1.4)<1e-8);
  assert.ok(Math.abs(loaded.time-(unloaded.time-22)*1.4-22)<1e-8);
  assert.ok(Math.abs(loaded.loadPenaltyMin-(loaded.time-unloaded.time))<1e-8);
});

test('a time-risk warning appears when the original loaded itinerary no longer fits',()=>{
  const original=calculate(),loaded=calculate({extraLoadKg:30});
  assert.equal(original.nominalViable,true);
  assert.equal(loaded.nominalViable,false);assert.equal(loaded.loadRisk,'critical');
  assert.ok(loaded.stops.length<original.stops.length);
  assert.ok(loaded.viable);
  assert.equal(calculate({current:'skinner',selected:[],elapsed:25,budget:80,extraLoadKg:80}).viable,false);
  assert.equal(carriedLoad(NaN).kg,0);assert.equal(carriedLoad(-8).kg,0);
});

test('return preview includes equipment weight in both immediate and future return estimates',()=>{
  const base={current:'crew',anchor:{from:'base',to:'junction',fraction:.5},selected:[],elapsed:4};
  const light=returnEcho(base,0),heavy=returnEcho({...base,extraLoadKg:20},0);
  assert.ok(Math.abs(heavy.now.time-light.now.time*1.4)<1e-9);
  assert.ok(Math.abs(heavy.later.time-heavy.now.time)<1e-9);
});

test('weather is deterministic, local to each sector and explicitly simulated',()=>{
  const jezero=scenarioWeather('jezero'),gale=scenarioWeather('gale');
  assert.notEqual(jezero.temperatureC,gale.temperatureC);
  assert.notEqual(jezero.windMps,gale.windMps);
  assert.equal(jezero.simulated,true);assert.equal(jezero.localTime,'09:00');
  assert.deepEqual(scenarioWeather('jezero'),jezero);
  assert.equal(scenarioWeather('jezero',{elapsedMin:120}).localTime,'11:00');
  assert.match(scenarioWeather('gale',{dust:true}).visibility,/Poor/);
});
