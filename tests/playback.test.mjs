import test from 'node:test';
import assert from 'node:assert/strict';
import {playbackMinutes,shouldPrepareTurn,PLAYBACK} from '../playback.mjs';

test('normal playback is eight times slower and cautions or speech slow it further',()=>{
  assert.equal(playbackMinutes(100),.025);
  assert.equal(playbackMinutes(100,{caution:true}),.008);
  assert.equal(playbackMinutes(100,{speaking:true}),.008);
  assert.equal(playbackMinutes(100,{caution:true,speaking:true}),.008);
  assert.equal(PLAYBACK.normalMinPerSecond,2/8);
});
test('a delayed timer cannot skip ahead through an instruction or hazard',()=>{
  assert.equal(playbackMinutes(60000),playbackMinutes(250));
  for(const dt of [NaN,Infinity,-1,0])assert.equal(playbackMinutes(dt),0);
});
test('turn guidance starts fourteen real seconds before the next node',()=>{
  assert.equal(shouldPrepareTurn(3.5),true);
  assert.equal(shouldPrepareTurn(3.6),false);
  assert.equal(shouldPrepareTurn(1.1,{caution:true}),true);
  assert.equal(shouldPrepareTurn(1.2,{caution:true}),false);
  assert.equal(shouldPrepareTurn(Infinity),false);
});
