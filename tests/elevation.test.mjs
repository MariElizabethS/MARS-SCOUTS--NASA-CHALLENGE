import test from 'node:test';
import assert from 'node:assert/strict';
import {elevationProfile} from '../elevation.mjs';
import {edgeDistance,nodeById} from '../engine.mjs';

test('the profile interpolates height and distance at the current fractional position',()=>{
  const p=elevationProfile({path:['base','junction','wildcat'],fraction:.5});
  assert.equal(p.height,6);assert.equal(p.currentDistance,edgeDistance('base','junction')/2);
  assert.equal(p.remaining,p.distance-p.currentDistance);assert.equal(p.peak,31);
});
test('moving to the next segment keeps the cursor continuous',()=>{
  const path=['base','junction','wildcat'],before=elevationProfile({path,fraction:1}),after=elevationProfile({path,segmentIndex:1,fraction:0});
  assert.equal(before.currentDistance,after.currentDistance);assert.equal(before.height,after.height);
  assert.deepEqual(before.points,after.points);
});
test('a revised profile begins at the actual mid-edge anchor',()=>{
  const anchor={from:'base',to:'junction',fraction:.4},p=elevationProfile({path:['crew','base'],anchor});
  assert.equal(p.height,nodeById('crew',anchor).z);assert.equal(p.remaining,edgeDistance('crew','base',anchor));
  assert.equal(elevationProfile({path:['invalid']}),null);assert.equal(elevationProfile(),null);
});
