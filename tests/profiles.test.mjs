import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,loadProfiles,saveProfiles,PROFILE_KEY} from '../profile-registry.mjs';
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};};

test('astronauts have unique normalized codes and retired rover profiles cannot be created',()=>{
  const astronaut=createProfile({code:' eva-01 ',name:'Alex'});
  const other=createProfile({code:'eva-02',name:'Explorer 02'},[astronaut]);
  assert.equal(astronaut.code,'EVA-01');assert.equal(other.kind,'astronaut');
  assert.notEqual(astronaut.color,other.color);
  assert.throws(()=>createProfile({code:'ROV-02',name:'Retired',kind:'rover'}),/Only astronaut/);
  assert.throws(()=>createProfile({code:'EVA-01',name:'Duplicate'},[astronaut]),/already exists/);
  assert.throws(()=>createProfile({code:'<script>',name:'Invalid'}),/unique code/);
});

test('saved missions remain independent and reload paused at their stored positions',()=>{
  const storage=memory(),profiles=[createProfile({code:'A1',name:'Astronaut'}),createProfile({code:'A2',name:'Astronaut 2'})];
  profiles[0].mission={traveledM:321,running:true,speaking:true,progress:{fraction:.4}};
  profiles[1].mission={traveledM:90,running:false};
  assert.equal(saveProfiles(storage,profiles,'A2'),true);
  const saved=loadProfiles(storage);
  assert.equal(saved.activeCode,'A2');assert.equal(saved.profiles[0].mission.running,false);
  assert.equal(saved.profiles[0].mission.progress.fraction,.4);
  assert.equal(saved.profiles[1].mission.traveledM,90);
  assert.equal(profiles[0].mission.running,true);
});

test('legacy rover entries are removed while astronaut missions and their active selection survive',()=>{
  const storage=memory(),astronaut={...createProfile({code:'EVA-01',name:'Explorer'}),mission:{traveledM:321}};
  storage.setItem(PROFILE_KEY,JSON.stringify({version:1,activeCode:'ROV-02',profiles:[{code:'ROV-02',name:'Old rover',kind:'rover'},astronaut]}));
  const saved=loadProfiles(storage);
  assert.equal(saved.profiles.length,1);assert.equal(saved.activeCode,'EVA-01');
  assert.equal(saved.profiles[0].mission.traveledM,321);
  saveProfiles(storage,saved.profiles,saved.activeCode);
  assert.ok(!storage.getItem(PROFILE_KEY).includes('ROV-02'));
});

test('unavailable or malformed local storage does not prevent the app from starting',()=>{
  assert.equal(loadProfiles(null),null);
  const storage=memory();storage.setItem(PROFILE_KEY,'{bad json');assert.equal(loadProfiles(storage),null);
  assert.equal(saveProfiles({setItem(){throw Error('quota');}},[],'A1'),false);
});
