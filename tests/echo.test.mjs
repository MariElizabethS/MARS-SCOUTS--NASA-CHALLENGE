import test from 'node:test';
import assert from 'node:assert/strict';
import {returnEcho} from '../echo.mjs';
import {edgeCost,nodeById} from '../engine.mjs';

const options={sector:'jezero',current:'base',elapsed:0,budget:120,minReserve:20,selected:['wildcat','skinner']};
test('the echo compares an immediate return with a future return without modifying the mission',()=>{
  const before=JSON.stringify(options),echo=returnEcho(options,1);
  assert.equal(JSON.stringify(options),before);assert.equal(echo.now.time,0);
  assert.equal(echo.advancedMin,1);assert.ok(echo.position.x>15);
  assert.ok(echo.later.reserve<echo.now.reserve);assert.equal(echo.later.path.at(-1),'base');
});
test('zero horizon starts from the actual mid-edge position including elapsed partial travel',()=>{
  const progress={path:['base','junction','wildcat','junction','base'],index:0,fraction:.4};
  const echo=returnEcho({...options,progress},0);
  assert.equal(echo.current,'crew');assert.ok(Math.abs(echo.anchor.fraction-.4)<1e-10);
  assert.equal(echo.now.elapsed,edgeCost('base','junction')*.4);
  assert.equal(echo.later.reserve,echo.now.reserve);
  assert.ok(Math.abs(echo.position.x-(15+(31-15)*.4))<1e-8);
});
test('a future observation consumes forecast time without moving the astronaut beyond the stop',()=>{
  const arrival=edgeCost('base','junction')+edgeCost('junction','wildcat');
  const echo=returnEcho(options,arrival+2);
  assert.equal(echo.current,'wildcat');assert.equal(echo.activity,true);
  assert.equal(echo.position.z,nodeById('wildcat').z);
  assert.ok(Math.abs(echo.later.elapsed-arrival-2)<1e-8);
});
test('echoes respect the slower walking pace and a blocked ridge',()=>{
  const normal=returnEcho(options,1),slow=returnEcho({...options,mobility:'reduced'},1);
  assert.ok(slow.position.x<normal.position.x);
  const gale=returnEcho({...options,sector:'gale',event:true,budget:300},20);
  assert.ok(!gale.now.path.includes('skinner'));assert.ok(!gale.later.path.includes('skinner'));
});
test('the preview identifies a lost reserve and supports a previously captured position',()=>{
  const echo=returnEcho({...options,current:'junction',elapsed:2,budget:32,minReserve:20,progress:{path:['junction','wildcat','junction','base'],index:0,fraction:0}},5);assert.equal(echo.later.viable,false);
  const anchored=returnEcho({...options,current:'crew',anchor:{from:'base',to:'junction',fraction:.3}},0);
  assert.ok(Math.abs(anchored.position.x-(15+(31-15)*.3))<1e-8);
});
