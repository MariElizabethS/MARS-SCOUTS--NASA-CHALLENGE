import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as engine from '../engine.mjs';
import * as safety from '../safety.mjs';
import * as physiology from '../physiology.mjs';
import * as playback from '../playback.mjs';
import {createHistoryPdf} from '../history-pdf.mjs';
import {elevationProfile} from '../elevation.mjs';
import {placeFacts} from '../places.mjs';
import {returnEcho} from '../echo.mjs';
import * as planner from '../route-planner.mjs';
import * as registry from '../profile-registry.mjs';
import * as conditions from '../conditions.mjs';
import * as navigation from '../navigation.mjs';

// A controlled clock checks application flows without browser/audio permissions.
async function app({storage}={}){
  const elements=new Map(),downloads=[],timeouts=new Map();let tick,now=0,id=0;
  function element(selector){
    if(!elements.has(selector))elements.set(selector,{hidden:true,style:{setProperty(name,value){this[name]=value;}},dataset:{},clientWidth:900,classList:{toggle(){}},
      addEventListener(){},setAttribute(name,value){this[name]=value;},getContext(){return {createImageData:(w,h)=>({data:new Uint8Array(w*h*4)}),putImageData(){}};},
      append(){},remove(){},click(){downloads.push(this.href);},close(){},showModal(){},scrollIntoView(){}});
    return elements.get(selector);
  }
  const document={body:element('body'),querySelector:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>element('download')};
  const blobs=new Map();
  const context=vm.createContext({...engine,...safety,...physiology,...playback,...planner,...registry,...conditions,...navigation,createHistoryPdf,elevationProfile,placeFacts,returnEcho,document,window:{localStorage:storage,addEventListener(){}},performance:{now:()=>now},Blob,
    URL:{createObjectURL(blob){blobs.set('blob:test',blob);return 'blob:test';},revokeObjectURL(){}},
    setInterval(fn){tick=fn;return ++id;},clearInterval(){tick=null;},setTimeout(fn,ms){timeouts.set(++id,{fn,ms});return id;},clearTimeout(key){timeouts.delete(key);}});
  const source=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .+;\r?\n/gm,'').replace(/drawTerrain\(\);update\(\);\s*$/,'update();');
  vm.runInContext(source+'\ndrawTerrain=()=>{};\nglobalThis.appApi={get state(){return state;},get profiles(){return profiles;},toggleWalk,elapsedNow,exportLog,showLog,monitorProximity,showNode,showPlaceData,toggleEcho,renderEcho,showRoutes,chooseRoute,addProfile,switchProfile,applyWellbeing,showSettings,getResult,teamReport,update,applyExtraLoad,showLoadReport,simulateDeviation,returnToRoute,showProfiles,actions,reset};',context);
  return Object.assign(context.appApi,{element,downloads,blobs,timeouts,startWalk(){if(!this.state.chosenRoute&&!this.state.progress){this.showRoutes();this.chooseRoute(0);}this.toggleWalk();},advance(ms){for(let n=0;n<ms;n+=100){now+=100;if(tick)tick();}}});
}

test('mid-edge pause and PDF export preserve actual elapsed time and traveled distance',async()=>{
  const a=await app();a.startWalk();a.advance(1000);
  assert.ok(Math.abs(a.elapsedNow()-.25)<1e-8);
  assert.ok(a.state.traveledM>0);
  a.showLog();assert.equal(a.state.running,false);
  assert.equal(a.state.logs[0].scenarioTimeS,15);
  const distance=a.state.traveledM;a.advance(5000);assert.equal(a.state.traveledM,distance);
  a.exportLog();assert.deepEqual(a.downloads,['blob:test']);
  const blob=a.blobs.get('blob:test');assert.equal(blob.type,'application/pdf');
  assert.ok(Buffer.from(await blob.arrayBuffer()).toString('latin1').startsWith('%PDF-1.4'));
});

test('a proximity warning appears once, expires, and still slows playback while nearby',async()=>{
  const a=await app();a.state.progress={position:[700,465],path:['base','junction'],index:0,fraction:.1};a.monitorProximity();
  assert.equal(a.element('#risk-alert').hidden,false);assert.equal(a.state.nearHazard,true);
  assert.equal(a.state.logs.length,1);a.monitorProximity();assert.equal(a.state.logs.length,1);
  [...a.timeouts.values()].find(t=>t.ms===14000).fn();
  assert.equal(a.element('#risk-alert').hidden,true);assert.equal(a.state.nearHazard,true);
  a.state.progress.position=[150,577.5];a.monitorProximity();assert.equal(a.state.nearHazard,false);
});

test('a complete walk records increasing event times and preserves traveled distance in its PDF',async()=>{
  const a=await app();a.startWalk();a.advance(2_000_000);
  assert.equal(a.state.finished,true);assert.equal(a.state.current,'base');
  assert.ok(a.state.traveledM>1000);
  const times=[...a.state.logs].reverse().map(e=>e.scenarioTimeS);
  for(let i=1;i<times.length;i++)assert.ok(times[i]>=times[i-1]);
  a.exportLog();const text=Buffer.from(await a.blobs.get('blob:test').arrayBuffer()).toString('latin1');
  assert.ok(text.includes('Walk completed'));assert.ok(text.includes((a.state.traveledM/1000).toFixed(2)+' km'));
});

test('the relief cursor moves within a segment and stays still while paused',async()=>{
  const a=await app();a.startWalk();const start=a.element('#elevation-cursor').transform,markup=a.element('#elevation-svg').innerHTML;
  a.advance(2000);assert.notEqual(a.element('#elevation-cursor').transform,start);
  assert.equal(a.element('#elevation-svg').innerHTML,markup);
  assert.match(a.element('#elevation-live').textContent,/Now: \+\d+ m/);
  a.toggleWalk();const paused=a.element('#elevation-cursor').transform;a.advance(2000);
  assert.equal(a.element('#elevation-cursor').transform,paused);
});

test('place details show sourced facts and pause the walk without changing its position',async()=>{
  const a=await app();a.startWalk();a.advance(1000);
  const elapsed=a.elapsedNow(),distance=a.state.traveledM;
  a.showNode('wildcat');assert.match(a.element('#map-tooltip').innerHTML,/data-action="place-data"/);
  a.showPlaceData('wildcat');assert.equal(a.state.running,false);
  assert.equal(a.elapsedNow(),elapsed);assert.equal(a.state.traveledM,distance);
  assert.match(a.element('#dialog-content').innerHTML,/Perseverance/);
  assert.match(a.element('#dialog-content').innerHTML,/https:\/\/science.nasa.gov\//);
});

test('the return echo previews future positions while leaving the live walk untouched',async()=>{
  const a=await app();a.startWalk();a.advance(1000);
  const elapsed=a.elapsedNow(),position=JSON.stringify(a.state.progress.position),distance=a.state.traveledM;
  a.toggleEcho();assert.equal(a.element('#echo-panel').hidden,false);
  a.state.echoHorizon=10;a.renderEcho(true);
  assert.equal(a.state.running,true);assert.equal(a.elapsedNow(),elapsed);
  assert.equal(JSON.stringify(a.state.progress.position),position);assert.equal(a.state.traveledM,distance);
  assert.match(a.element('#echo-layer').innerHTML,/stroke-dasharray/);
  a.advance(1000);assert.ok(a.elapsedNow()>elapsed);
  a.toggleEcho();assert.equal(a.element('#echo-panel').hidden,true);assert.equal(a.element('#echo-layer').innerHTML,'');
});

test('departure asks for a route and an alternative drives the actual completed walk',async()=>{
  const a=await app();a.toggleWalk();
  assert.equal(a.state.running,false);
  assert.match(a.element('#dialog-content').innerHTML,/CHOOSE YOUR ROUTE/);
  a.chooseRoute(2);const chosen=[...a.state.chosenRoute.path];
  a.toggleWalk();assert.deepEqual([...a.state.progress.path],chosen);
  a.advance(2_000_000);assert.equal(a.state.finished,true);
  assert.ok(Math.abs(a.state.traveledM-a.state.chosenRoute.distance)<1e-6);
  assert.equal(a.state.routeDecisions[0].chosenId,'route-3');
});

test('a two-minute rest shows traveled progress and preserves the position and distance',async()=>{
  const a=await app();a.startWalk();a.advance(6000);
  const elapsed=a.elapsedNow(),distance=a.state.traveledM,position=[...a.state.progress.position];
  a.applyWellbeing('reduced');
  assert.equal(a.state.running,false);assert.equal(a.state.traveledM,distance);
  assert.ok(Math.abs(a.elapsedNow()-elapsed-2)<1e-8);
  const node=engine.nodeById(a.state.current,a.state.anchor);
  assert.ok(Math.abs(node.x*10-position[0])<1e-8);
  assert.match(a.element('#dialog-content').innerHTML,/TWO-MINUTE CHECKPOINT/);
  assert.match(a.element('#dialog-content').innerHTML,/Already traveled/);
  assert.ok(a.state.logs.some(event=>event.title==='Rest checkpoint'));
});

test('switching astronauts preserves independent tracks and persists both on reload',async()=>{
  const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
  const a=await app({storage});a.startWalk();a.advance(4000);
  const astronautDistance=a.state.traveledM,astronautPosition=JSON.stringify(a.state.progress.position);
  a.addProfile({code:'EVA-02',name:'Explorer 02'});
  assert.equal(a.state.traveledM,0);assert.equal(a.profiles.length,2);
  a.state.budget=200;a.update();a.startWalk();a.advance(3000);
  const secondDistance=a.state.traveledM;
  assert.ok(secondDistance>0);
  a.switchProfile('EVA-01');
  assert.equal(a.state.running,false);assert.equal(a.state.traveledM,astronautDistance);
  assert.equal(JSON.stringify(a.state.progress.position),astronautPosition);
  assert.match(a.element('#map-svg').innerHTML,/EVA-02/);
  const reloaded=await app({storage});
  assert.equal(reloaded.state.traveledM,astronautDistance);
  assert.equal(reloaded.profiles.find(profile=>profile.code==='EVA-02').mission.traveledM,secondDistance);
  reloaded.switchProfile('EVA-02');
  assert.equal(reloaded.state.running,false);assert.equal(reloaded.state.traveledM,secondDistance);
  reloaded.exportLog();
  const pdf=Buffer.from(await reloaded.blobs.get('blob:test').arrayBuffer()).toString('latin1');
  assert.ok(pdf.includes('EVA-01')&&pdf.includes('EVA-02'));
  assert.ok(pdf.includes('[Selected]')&&pdf.includes('Along the way:'));
});

test('settings only expose mission time and place facts include local photos',async()=>{
  const a=await app();a.showSettings();
  assert.match(a.element('#dialog-content').innerHTML,/name="budget"/);
  assert.doesNotMatch(a.element('#dialog-content').innerHTML,/name="reserve"|oxygen/i);
  a.showPlaceData('wildcat');
  assert.match(a.element('#dialog-content').innerHTML,/<img src="assets\/places\/wildcat.jpg"/);
  assert.match(a.element('#dialog-content').innerHTML,/NASA\/JPL/);
});

test('place photos frame the landscape and link to their complete local originals',async()=>{
  const a=await app();
  for(const [id,width,height] of [['base',2400,1378],['wildcat',3225,2631],['skinner',2400,1331]]){
    a.showPlaceData(id);
    const html=a.element('#dialog-content').innerHTML;
    assert.match(html,new RegExp('width="'+width+'" height="'+height+'"'));
    assert.doesNotMatch(html,/place-photo-panorama|loading="lazy"/);
    assert.match(html,/View original photo/);
    assert.match(html,/style="aspect-ratio:[\d]+\/[\d]+;--photo-width:/);
  }
  a.state.sector='gale';a.showPlaceData('base');
  const html=a.element('#dialog-content').innerHTML;
  assert.match(html,/width="2400" height="900"/);
  assert.doesNotMatch(html,/place-photo-panorama|scroll sideways/);
  assert.match(html,/Peace Vallis/);
  assert.match(html,/<a class="place-photo" href="assets\/places\/gale.jpg"/);
  assert.match(html,/<a href="assets\/places\/gale.jpg" target="_blank"/);
});

test('each Gale observation shows its own photo and switching areas restores Jezero photos',async()=>{
  const a=await app(),sources=[];
  a.state.sector='gale';
  for(const [id,file,width,height] of [['wildcat','gale-hollow',1632,1200],['skinner','gale-ridge',2400,1973],['lookout','gale-lookout',4000,747]]){
    a.showPlaceData(id);
    const html=a.element('#dialog-content').innerHTML;
    const src=html.match(/<img src="([^"]+)"/)[1];
    assert.equal(src,'assets/places/'+file+'.jpg');
    assert.match(html,new RegExp('width="'+width+'" height="'+height+'"'));
    assert.doesNotMatch(html,/<img src="assets\/places\/(gale|wildcat|skinner)\.jpg"/);
    sources.push(src);
  }
  assert.equal(new Set(sources).size,3);
  a.showPlaceData('junction');
  assert.match(a.element('#dialog-content').innerHTML,/<img src="assets\/places\/gale-junction.jpg"/);
  a.state.sector='jezero';
  for(const id of ['wildcat','skinner']){
    a.showPlaceData(id);
    assert.equal(a.element('#dialog-content').innerHTML.match(/<img src="([^"]+)"/)[1],'assets/places/'+id+'.jpg');
  }
});

test('reporting extra equipment mid-edge preserves elapsed travel and requires reviewing a time-risk plan',async()=>{
  const a=await app();a.startWalk();a.advance(4000);
  const distance=a.state.traveledM,elapsed=a.elapsedNow(),position=[...a.state.progress.position];
  a.applyExtraLoad(30);
  assert.equal(a.state.running,false);assert.equal(a.state.extraLoadKg,30);
  assert.equal(a.state.traveledM,distance);assert.ok(Math.abs(a.elapsedNow()-elapsed)<1e-9);
  const point=engine.nodeById(a.state.current,a.state.anchor);
  assert.ok(Math.abs(point.x*10-position[0])<1e-9);
  assert.equal(a.state.proposal,true);assert.equal(a.state.loadReview.viable,false);
  assert.match(a.element('#dialog-content').innerHTML,/Warning: the requested route/);
  assert.equal(a.element('#load-warning').hidden,false);
  a.exportLog();const pdf=Buffer.from(await a.blobs.get('blob:test').arrayBuffer()).toString('latin1');
  assert.ok(pdf.includes('Extra equipment reported'));
  assert.ok(pdf.includes('Extra equipment: 30.0 kg'));
  assert.ok(pdf.includes('Scenario weather - Jezero Crater'));
  a.showRoutes();a.chooseRoute(0);a.toggleWalk();a.advance(2_000_000);
  assert.equal(a.state.finished,true);assert.equal(a.state.extraLoadKg,30);
});

test('a deviation visibly progresses, warns while leaving, and then activates a real alternative',async()=>{
  const a=await app();a.startWalk();a.advance(4000);
  const distance=a.state.traveledM,elapsed=a.elapsedNow();
  a.simulateDeviation();
  assert.equal(a.state.traveledM,distance);assert.equal(a.elapsedNow(),elapsed);
  assert.ok(a.state.navigationDemo);
  a.advance(1000);const intermediate=a.state.traveledM;
  assert.ok(intermediate>distance);assert.ok(a.state.navigationDemo);
  a.advance(2000);
  assert.equal(a.state.rerouteNotice.kind,'departing');
  assert.match(a.element('#reroute-title').textContent,/leaving your route/);
  assert.ok(a.state.navigationDemo.departedM>0&&a.state.navigationDemo.departedM<50);
  a.advance(5000);
  assert.equal(a.state.navigationDemo,null);
  assert.equal(a.state.running,true);
  assert.equal(a.state.chosenRoute.name,'Alternative route');
  assert.equal(a.state.chosenRoute.color,'#51dccb');
  assert.equal(a.state.progress.path[0],'crew');assert.equal(a.element('#reroute-notice').hidden,false);
  a.advance(1000);assert.equal(a.element('#reroute-notice').hidden,false);
  assert.ok(a.state.logs.some(event=>event.title==='Off-route warning'));
  assert.equal(a.state.routeDecisions.at(-1).trigger,'off-route alternative');
  a.advance(2_000_000);assert.equal(a.state.finished,true);
});

test('a dead-end deviation requests a return and retraces the side corridor only when confirmed',async()=>{
  const a=await app();
  a.state.current='crossing';a.state.selected=['wildcat'];a.state.budget=200;
  a.state.elapsed=15;a.state.traveledM=500;a.state.track=[[640,352.5]];
  a.update();a.showRoutes();a.chooseRoute(0);
  const originalPath=[...a.state.chosenRoute.path];
  a.simulateDeviation();a.advance(4500);
  assert.equal(a.state.navigationDemo.phase,'awaiting-return');
  assert.equal(a.state.anchor.to,'skinner');
  assert.equal(a.state.running,false);assert.equal(a.state.rerouteNotice.kind,'return');
  assert.match(a.element('#reroute-message').textContent,/Turn back/);
  assert.equal(a.element('#return-to-route-button').hidden,false);
  assert.match(a.element('#map-svg').innerHTML,/return-guidance/);
  const position=JSON.stringify(a.state.anchor),distance=a.state.traveledM;
  a.advance(2000);assert.equal(a.state.traveledM,distance);assert.equal(JSON.stringify(a.state.anchor),position);
  a.actions['return-to-route']();a.advance(4500);
  assert.equal(a.state.navigationDemo,null);assert.equal(a.state.current,'crossing');
  assert.ok(Math.abs(a.state.traveledM-600)<1e-6);
  assert.deepEqual([...a.state.chosenRoute.path],originalPath);
  assert.ok(!a.state.completed.includes('skinner'));
  assert.equal(a.state.rerouteNotice.kind,'restored');
  a.toggleWalk();a.advance(2_000_000);assert.equal(a.state.finished,true);
});

test('pausing and reloading a deviation preserves the actual moving position without a jump',async()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const a=await app({storage});a.showRoutes();a.chooseRoute(0);a.simulateDeviation();a.advance(1500);
  a.toggleWalk();const distance=a.state.traveledM,anchor=JSON.stringify(a.state.anchor);
  a.advance(5000);assert.equal(a.state.traveledM,distance);
  const reloaded=await app({storage});
  assert.equal(reloaded.state.running,false);assert.equal(reloaded.state.traveledM,distance);
  assert.equal(JSON.stringify(reloaded.state.anchor),anchor);
  reloaded.toggleWalk();reloaded.advance(500);
  assert.ok(reloaded.state.traveledM>distance&&reloaded.state.traveledM<50);
});

test('leaving the final corridor moves off its line and asks for a retraced return without inventing a route',async()=>{
  const a=await app();a.state.current='crew';a.state.anchor={from:'base',to:'junction',fraction:.45};
  a.state.selected=[];a.state.track=[[222,516.75]];a.state.traveledM=200;a.state.elapsed=10;
  a.update();a.showRoutes();a.chooseRoute(0);
  const originalAnchor=JSON.stringify(a.state.anchor),before=a.state.traveledM;
  a.simulateDeviation();a.advance(1500);
  assert.ok(a.state.offRoutePosition);
  assert.ok(a.state.traveledM>before&&a.state.traveledM<before+50);
  assert.ok(a.element('#map-svg').innerHTML.includes('translate('+a.state.offRoutePosition.x*10+','+a.state.offRoutePosition.y*7.5+')'));
  a.advance(3000);assert.equal(a.state.navigationDemo.phase,'awaiting-return');
  assert.match(a.element('#reroute-message').textContent,/No verified alternative/);
  a.returnToRoute();a.advance(4500);
  assert.equal(a.state.offRoutePosition,null);assert.equal(a.state.navigationDemo,null);
  assert.equal(JSON.stringify(a.state.anchor),originalAnchor);
  assert.ok(Math.abs(a.state.traveledM-before-100)<1e-6);
  a.toggleWalk();a.advance(2_000_000);assert.equal(a.state.finished,true);
});

test('the lower profile circles switch astronaut state and extra equipment remains profile-specific',async()=>{
  const a=await app();a.applyExtraLoad(8);a.addProfile({code:'EVA-02',name:'Second Explorer'});
  assert.equal(a.state.extraLoadKg,0);
  assert.match(a.element('.crew-avatars').innerHTML,/data-action="select-profile" data-code="EVA-01"/);
  a.actions['select-profile']({dataset:{code:'EVA-01'}});
  assert.equal(a.state.extraLoadKg,8);assert.equal(a.state.running,false);
  a.showProfiles();assert.doesNotMatch(a.element('#dialog-content').innerHTML,/Rover|name="kind"/);
});

test('weather panel follows the selected Mars sector and marks its readings as scenario data',async()=>{
  const a=await app();const initial=a.element('#weather-temperature').textContent;
  assert.match(initial,/°C/);
  a.reset('gale');assert.match(a.element('#weather-temperature').textContent,/°C/);
  assert.notEqual(a.element('#weather-temperature').textContent,initial);
});

test('hazard warnings explain the danger and offer a route outside the marked areas from the actual position',async()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const a=await app({storage});a.startWalk();
  for(let i=0;i<200&&!a.state.activeNotice?.zoneId;i++)a.advance(1000);
  assert.equal(a.state.activeNotice.zoneId,'steep-slope');
  assert.match(a.element('#risk-message').textContent,/steep incline|slipping/i);
  assert.equal(a.element('#risk-route-button').hidden,false);
  const distance=a.state.traveledM,elapsed=a.elapsedNow(),position=[...a.state.progress.position];
  a.actions['avoid-hazards']();
  assert.equal(a.state.running,false);assert.equal(a.state.proposal,true);
  assert.equal(a.state.traveledM,distance);assert.ok(Math.abs(a.elapsedNow()-elapsed)<1e-8);
  const point=engine.nodeById(a.state.current,a.state.anchor);
  assert.ok(Math.abs(point.x*10-position[0])<1e-8&&Math.abs(point.y*7.5-position[1])<1e-8);
  assert.match(a.element('#dialog-content').innerHTML,/Choose a route outside the danger zones/);
  assert.match(a.element('#dialog-content').innerHTML,/Not included in this safer plan: Skinner Ridge/);
  a.chooseRoute(0);assert.equal(a.state.proposal,false);
  assert.ok(!a.state.chosenRoute.path.includes('skinner'));
  for(let i=1;i<a.state.chosenRoute.path.length;i++)for(const zone of safety.hazards)assert.equal(safety.segmentIntersectsHazard(engine.nodeById(a.state.chosenRoute.path[i-1],a.state.anchor),engine.nodeById(a.state.chosenRoute.path[i],a.state.anchor),zone),false);
  const restored=await app({storage});
  assert.deepEqual([...restored.state.avoidedHazards],[...a.state.avoidedHazards]);
  assert.equal(restored.state.running,false);assert.equal(restored.state.traveledM,distance);
  restored.toggleWalk();restored.advance(2_000_000);assert.equal(restored.state.finished,true);
  assert.ok(restored.state.logs.some(log=>log.title==='Hazard avoidance route selected'));
  restored.reset();assert.equal(restored.state.avoidedHazards.length,0);
});

test('an unavailable safe route leaves the mission paused and explains that no route fits',async()=>{
  const a=await app();a.startWalk();
  for(let i=0;i<200&&!a.state.activeNotice?.zoneId;i++)a.advance(1000);
  a.state.budget=5;a.actions['avoid-hazards']();
  assert.equal(a.state.running,false);assert.equal(a.state.proposal,true);
  assert.match(a.element('#dialog-content').innerHTML,/No safe route available/);
  assert.equal(a.element('#start-button').disabled,true);
  const distance=a.state.traveledM;a.toggleWalk();a.advance(10000);assert.equal(a.state.traveledM,distance);
});

test('small maps show the full names of every observation stop in both sectors',async()=>{
  const a=await app();a.element('#map-viewport').clientWidth=360;
  for(const sector of ['jezero','gale']){
    a.reset(sector);
    const map=a.element('#map-svg').innerHTML;
    for(const stop of Object.values(engine.sectors[sector].stops))assert.ok(map.includes('>'+stop.name+'</text>'),stop.name);
    assert.doesNotMatch(map,/>Stop [12]<|>Lookout</);
  }
});
