import {sectors,nodes,edges,nodeById,edgeDistance,edgeCost,calculate} from './engine.mjs';
import {hazardsFor,ProximityMonitor,NoticeGate,operationalMobility} from './safety.mjs';
import {initialPhysiology,advancePhysiology} from './physiology.mjs';
import {createHistoryPdf} from './history-pdf.mjs';
import {PLAYBACK,playbackMinutes,shouldPrepareTurn} from './playback.mjs';
import {elevationProfile} from './elevation.mjs';
import {placeFacts} from './places.mjs';
import {returnEcho} from './echo.mjs';
import {routeOptions,waypointName} from './route-planner.mjs';
import {createProfile,loadProfiles,saveProfiles} from './profile-registry.mjs';
import {scenarioWeather,carriedLoad} from './conditions.mjs';
import {missedTurn,segmentPosition,deviationRecovery} from './navigation.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
let state={sector:'jezero',event:false,dust:false,budget:120,minReserve:20,selected:['wildcat','skinner'],approvedStops:null,current:'base',elapsed:0,completed:[],finished:false,running:false,proposal:false,decision:null,revision:0,logs:[],zoom:1,pan:{x:0,y:0},layers:{corridors:true,reach:true,hazards:true,labels:true},view:'terrain',progress:null,health:{profile:'nominal',stale:false},voiceEnabled:true,voiceMessage:'Proximity alerts active. No hazard announcements when no hazards are nearby.',activeNotice:null};
const notices=new NoticeGate();
const proximityMonitor=new ProximityMonitor();
state.physiology=initialPhysiology();
state.traveledM=0;state.track=[[150,577.5]];state.nearHazard=false;state.speaking=false;
state.echoEnabled=false;state.echoHorizon=5;
state.chosenRoute=null;state.routeChoices=[];state.routeDecisions=[];state.restFeedback=null;
state.extraLoadKg=0;state.loadReview=null;state.deviation=null;state.rerouteNotice=null;state.navigationDemo=null;state.offRoutePosition=null;
state.avoidedHazards=[];
const emptyMission=JSON.parse(JSON.stringify(state));
let profiles=[],activeCode='EVA-01',routeDrafts=[],lastSavedAt=-Infinity;
let storage;try{storage=window.localStorage;}catch{storage=null;}
let savedLocally=false;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let speechSequence=0;
let result, timer, toastTimer, riskTimer, audioContext, lastEchoAt=-Infinity, speechText='', globeAngle=.7, globeDrag=null;
function elapsedNow(){const p=state.progress;return state.elapsed+(p?.path[p.index+1]&&state.current!==p.path[p.index+1]?edgeCost(p.path[p.index],p.path[p.index+1],result.speed,state.anchor)*p.fraction:0);}
function record(title,details){state.logs.unshift({time:new Date().toISOString(),scenarioTimeS:Math.round(elapsedNow()*60),sector:state.sector,title,details,revision:state.revision});$('#log-dot').hidden=false;}
function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function getResult(){
  const preferredPath=state.finished||state.navigationDemo?null:state.progress?.path.slice(state.progress.index)??state.chosenRoute?.path;
  const plan=calculate({...state,preferredPath,mobility:operationalMobility(state.health),selected:state.finished?[]:(state.approvedStops??state.selected).filter(id=>!state.completed.includes(id))});
  if(!state.offRoutePosition)return plan;
  const origin=state.navigationDemo.originalPoints[0],point=state.offRoutePosition;
  const backM=Math.hypot(point.x-origin[0]/10,point.y-origin[1]/7.5)*10,backMin=backM/plan.speed;
  return {...plan,time:plan.time+backMin,distance:plan.distance+backM,totalTime:plan.totalTime+backMin,reserve:plan.reserve-backMin,viable:plan.reserve-backMin>=state.minReserve};
}

function fmt(n,unit='min'){return Number.isFinite(n)?`${Math.round(n)} ${unit}`:'No access';}
function update(){
  result=getResult();const sector=sectors[state.sector];
  document.body.dataset.zone=state.sector;document.body.dataset.profileKind=activeProfile().kind;
  document.body.style.setProperty('--route-color',state.chosenRoute?.color||(state.sector==='jezero'?'#c4a0ff':'#e5a06a'));
  $('meta[name="theme-color"]').content=state.sector==='jezero'?'#100b19':'#1d1916';
  if(state.proposal||!result.viable||state.decision==='rejected')$('.copilot-card').open=true;
  if((!result.viable&&!state.navigationDemo)||state.health.stale)pause();
  $('#destination-name').textContent=sector.name;$('#destination-coords').textContent=sector.coordinates;$('#mission-name').textContent=sector.mission;$('#map-title').textContent=sector.title;$('#map-location-label').textContent=sector.region;
  $('#event-label').textContent=state.event?'See how my route changed':state.sector==='jezero'?'Walk more slowly':'Avoid the ridge';
  $('#event-help').textContent=state.event?'Compare the previous route with the new proposal.':state.sector==='jezero'?'Calculate the return at a slower walking pace.':'Close ridge access and find another way back.';
  $('#conditions-status').textContent=state.event||state.dust||state.extraLoadKg>0||state.avoidedHazards.length?'Adjusted route':'Normal route';
  $('#conditions-help').textContent=state.proposal?'The walk is paused. Review the proposal in “Return and alerts” and accept it to continue.':'If you need a slower pace or visibility is poor, adjust an option. The walk will pause so you can review the new route before continuing.';
  $('#visibility-label').textContent=state.dust?'Visibility has improved':'Visibility is poor';
  $('#visibility-help').textContent=state.dust?'Reassess observations with normal visibility.':'Exclude observations that require a clear distant view.';
  $('#visibility-button').setAttribute('aria-pressed',String(state.dust));
  monitorProximity();
  $('#summary-context').textContent=state.proposal?'Estimates for the proposal under review':state.finished?'Your walk has ended':'Includes observations and return';
  $('#stat-distance').innerHTML=`${Number.isFinite(result.distance)?(result.distance/1000).toFixed(2):'—'} <small>km</small>`;
  $('#stat-duration').innerHTML=`${Number.isFinite(result.totalTime)?Math.round(result.totalTime):'—'} <small>min</small>`;
  $('#stat-reserve').innerHTML=`${Number.isFinite(result.reserve)?Math.round(result.reserve):'—'} <small>min</small>`;
  $('.reserve-stat strong').style.color=result.viable?'var(--green)':'#f0a48e';
  $('.reserve-box').classList.toggle('critical',!result.viable);
  $('#reserve-title').textContent=result.viable?(state.proposal?'This proposal allows a return':'Your route includes returning to base'):'We need to review the return';
  $('#reserve-description').textContent=result.viable?`At least ${state.minReserve} min of margin on return.`:'The available time cannot cover the selected margin.';
  $('#decision-actions').hidden=!state.proposal;
  $('[data-action="accept"]').disabled=!result.viable;
  $('#start-button').disabled=state.finished||state.proposal||!result.viable||state.health.stale||state.decision==='rejected';
  $('[data-action="accept"]').disabled=!result.viable||state.health.stale;
  $('#start-button').innerHTML=icon(state.finished?'check':state.running?'pause':'play')+`<span>${state.finished?'Walk completed':state.health.stale?'Refresh the health signal':!result.viable?'Review available time':state.proposal?'Review the new route':state.decision==='rejected'?'Plan awaiting review':state.running?'Pause walk':!state.chosenRoute&&!state.progress?'Choose a route':state.elapsed>0||state.progress?'Continue walk':'Start walk'}</span>`;
  $('#copilot-message').textContent=copilotMessage();speechText=$('#copilot-message').textContent;
  $('.crew-footer>div:last-child>span').textContent=`${profiles.length} registered · ${activeProfile().code} active`;
  $('.crew-footer strong').textContent='Your surface team.';
  renderProfileBar();renderRouteSummary();renderConditions();renderRerouteNotice();persistMission(Boolean(state.navigationDemo));
  $('#profile-label').textContent=result.alternative?sector.stops.lookout.name:sector.stops.wildcat.name;
  const alert=$('#alert-banner');alert.hidden=!(state.proposal||state.decision==='rejected'||state.event);
  if(!alert.hidden){alert.innerHTML=`${icon('info')}<span><strong>${state.proposal?'A new route is ready to review':state.decision==='rejected'?'Taking a moment to review':'Route updated with your input'}</strong><br>${state.proposal?'The walk is paused. Review the return proposal before continuing.':state.decision==='rejected'?'The change has not been applied. Adjust the plan or restart the walk.':'Your decision was saved in the history.'}</span><button data-action="${state.event?'compare':'review-plan'}">${state.event?'Compare routes':'View proposal'}</button>`;}
  renderHealth();renderWalkStatus();renderDemoStatus();syncVoice();renderItinerary();renderMap();renderElevation();renderEcho(true);
}
function copilotMessage(){
  if(state.avoidedHazards.length&&state.proposal)return result.viable?'Hazardous areas are excluded from the new plan. Compare the safer routes and check which observations remain available before continuing.':'No safe mapped return fits the current hazard restrictions and time. The walk stays paused. Review the stops or mission time.';
  if(!result.viable)return 'No viable return is possible with the current time and margin. The walk is paused. Adjust the available time or stops before continuing.';
  if(state.finished)return `Walk completed. Total time: ${Math.round(state.elapsed)} min. Remaining margin: ${Math.round(state.budget-state.elapsed)} min. Walk decisions are saved in the history.`;
  if(state.decision==='rejected')return 'The change has not been applied. Adjust the stops or available time to prepare another route. The walk remains paused.';
  if(state.proposal||state.event||state.health.profile==='reduced'||state.dust||state.extraLoadKg>0){
    const cause=state.extraLoadKg>0?`Your ${state.extraLoadKg} kg of extra equipment is included in the walking time (${result.speed.toFixed(1)} m/min).`:state.health.profile==='reduced'?'After resting, the route is calculated at a reduced pace.':state.event?(state.sector==='jezero'?'Reduced mobility increases the return time.':'Ridge access is closed.'):'The route uses your selected conditions.';
    const option=result.alternative?`We can visit the lookout and return with ${Math.round(result.reserve)} min of margin. The distant observation still needs validation.`:result.stops.length?`We can keep ${result.stops.length} stop${result.stops.length>1?'s':''} and return with ${Math.round(result.reserve)} min of margin.`:`I suggest returning directly to base with ${Math.round(result.reserve)} min of margin. ${state.dust?'Poor visibility prevents observation from the lookout.':''}`;
    return `${cause} ${option} ${state.proposal?'Review and confirm this route to continue.':'Plan approved. Continue when you are ready.'}`;
  }
  return `Route ready: ${state.selected.length} stop${state.selected.length>1?'s':''}, return to Ares Base and ${Math.round(result.reserve)} min of margin. Start when you are ready. Voice alerts play when you approach a hazard.`;
}

function renderHealth(){
  const h=state.health,p=state.physiology,card=$('.health-card');
  $('.health-heading p').textContent=activeProfile().name+' · '+activeProfile().code;
  card.classList.toggle('resting',!state.running&&p.timeMin>0);
  $('#health-status').textContent=state.running?'Walking':state.finished?'Walk finished':p.timeMin>0?'Paused':'Standing by';
  $('#health-pulse').innerHTML=Math.round(p.heartRate)+' <small>bpm</small>';
  $('#health-respiration').innerHTML=Math.round(p.respiratoryRate)+' <small>breaths/min</small>';
  $('#health-spo2').innerHTML=p.spo2.toFixed(1)+' <small>%</small>';
  $('#health-effort').innerHTML=Math.round(p.effort)+' <small>%</small>';
  $('#effort-fill').style.width=p.effort+'%';
  $('#health-mobility').textContent=result.speed.toFixed(1)+' m/min'+(h.profile==='reduced'?' · reduced':'');
  $('#feel-good').setAttribute('aria-pressed',String(h.profile==='nominal'));
  $('#rest-button').setAttribute('aria-pressed',String(h.profile==='reduced'));
  $('#feel-good').disabled=state.finished;$('#rest-button').disabled=state.finished;
  $('#health-feedback').textContent=state.running?'Readings respond to pace, slope, extra load and walking time.':p.timeMin>0?'Rest reduces workload. Each 2 min rest counts toward mission time.':'Workload changes as you move. Extra equipment is reported separately from your suit.';
  const history=p.history.length>1?p.history:[p.heartRate,p.heartRate];
  $('#pulse-trace').setAttribute('points',history.map((hr,i)=>i/(history.length-1)*130+','+(27-(hr-65)/90*24)).join(' '));
}

function renderWalkStatus(){
  const name=id=>id==='base'?'Ares Base':sectors[state.sector].stops[id]?.name||'the next waypoint';
  $('#walk-state').textContent=state.finished?'Back at base':state.health.stale?'Signal needs updating':!result.viable?'Time needs review':state.proposal?'Waiting for your decision':state.running?'Walking':state.decision==='rejected'?'Plan needs review':state.elapsed>0||state.progress?'Walk paused':'Preparing your walk';
  $('#next-action').textContent=state.finished?'Walk finished! Your history is ready.':state.health.stale?'Next: refresh the health signal.':!result.viable?'Next: review the available time in Settings. This margin does not allow departure.':state.proposal?'Next: review and accept the new route.':state.running?`Heading toward ${name(state.progress?.path[state.progress.index+1])}. Pause at any time.`:state.decision==='rejected'?'Next: adjust the plan before continuing.':state.elapsed>0||state.progress?'Next: continue when you feel ready.':'Next: review your status and stops, then start the walk.';
  $('#walk-position').textContent=state.current==='crew'?'You are between two waypoints. The new route starts from there.':state.progress&&state.progress.fraction>0?'Your position moves along the highlighted segment. Follow it on the map.':`You are at ${name(state.current)}. ${state.elapsed?'The route always includes returning to base.':'The walk has not started yet.'}`;
  const p=state.progress,partial=p&&p.path[p.index+1]?edgeCost(p.path[p.index],p.path[p.index+1],result.speed,state.anchor)*Math.min(1,p.fraction):0;
  $('#elapsed-time').textContent=`${Math.round(state.elapsed+partial)} min elapsed`;
  if(!state.running&&!$('#navigation-cue').hidden)$('#navigation-message').textContent=state.finished?'You have returned to Ares Base. Your history is ready.':'Walk paused. Review the map and continue when you are ready.';
}
function syncVoice(){
  $('#voice-toggle').setAttribute('aria-pressed',String(state.voiceEnabled));
  $('#voice-toggle-label').textContent=state.voiceEnabled?'Sound and voice on':'Sound and voice muted';
  $('#voice-status').textContent=state.voiceMessage;
}
function unlockSound(){
  if(!state.voiceEnabled)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioContext??=new Audio();void audioContext.resume().catch(()=>{});}catch{/* Written alerts remain available. */}
}
function soundAlarm(critical){
  if(!state.voiceEnabled||!audioContext||audioContext.state!=='running')return;
  const now=audioContext.currentTime;
  for(let i=0;i<(critical?3:2);i++){
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=now+i*.22;
    oscillator.type='sine';oscillator.frequency.value=critical?740:520;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.17);
    oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.18);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
function speakMessage(message,{automatic=false}={}){
  if(!state.voiceEnabled)return;
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){state.voiceMessage='Voice is unavailable in this browser. All alerts will still appear on screen.';syncVoice();return;}
  const sequence=++speechSequence;
  window.speechSynthesis.cancel();
  state.automaticVoice=automatic;
  state.speaking=true;
  const utterance=new window.SpeechSynthesisUtterance(message);
  utterance.lang='en-US';utterance.rate=.87;
  utterance.onstart=()=>{if(sequence!==speechSequence)return;state.voiceMessage='Listen to the instruction. It is also shown on screen.';syncVoice();};
  utterance.onend=()=>{if(sequence!==speechSequence)return;state.automaticVoice=false;state.speaking=false;state.voiceMessage='Advance guidance and proximity alarms active.';syncVoice();};
  utterance.onerror=e=>{if(sequence!==speechSequence)return;state.speaking=false;state.automaticVoice=false;if(e.error==='canceled'||e.error==='interrupted')return;state.voiceMessage='Voice playback failed. Read the instruction on screen.';syncVoice();};
  try{window.speechSynthesis.speak(utterance);}catch{state.speaking=false;state.voiceMessage='Voice could not start. Read the alert on screen.';syncVoice();}
}
function announce({key,title,message,critical=false,zoneId=null}){
  if(!notices.take(key))return;
  state.activeNotice={title,message,critical,zoneId};
  $('#risk-title').textContent=title;$('#risk-message').textContent=message;
  $('#risk-alert').hidden=false;$('#risk-alert').classList.toggle('critical',critical);
  $('#risk-route-button').hidden=!zoneId||state.avoidedHazards.includes(zoneId)||Boolean(state.offRoutePosition);
  clearTimeout(riskTimer);
  if(!critical)riskTimer=setTimeout(()=>{$('#risk-alert').hidden=true;},14000);
  record(title,message);soundAlarm(critical);speakMessage(message,{automatic:true});
}
function activeHazards(){return hazardsFor(state);}
function showSaferRoutes(){
  const zone=activeHazards().find(hazard=>hazard.id===state.activeNotice?.zoneId);
  if(!zone||state.offRoutePosition||state.finished)return;
  freezePosition();
  state.avoidedHazards=[...new Set([...state.avoidedHazards,...activeHazards().map(hazard=>hazard.id)])];
  state.chosenRoute=null;state.routeChoices=[];state.revision++;state.proposal=true;state.decision=null;
  record('Hazard avoidance requested',zone.name+'. '+zone.description+' Replanning from the actual position, avoiding all marked danger zones.');
  showRoutes();
}
function monitorProximity(){
  const pos=state.offRoutePosition?[state.offRoutePosition.x*10,state.offRoutePosition.y*7.5]:state.progress?.position||xy(state.current),{active,events}=proximityMonitor.update({x:pos[0]/10,y:pos[1]/7.5},activeHazards());
  state.nearHazard=active.length>0;
  if(!active.length){
    state.activeNotice=null;$('#risk-alert').hidden=true;clearTimeout(riskTimer);
    if(state.automaticVoice&&'speechSynthesis'in window){speechSequence++;window.speechSynthesis.cancel();state.automaticVoice=false;state.speaking=false;state.voiceMessage='No nearby hazards. Route guidance remains active.';syncVoice();}
    return;
  }
  if(active.some(zone=>zone.critical))pause();
  for(const zone of events.slice(0,1)){
    if(zone.critical)pause();
    const avoiding=state.avoidedHazards.includes(zone.id);
    const message=(zone.phase==='inside'?'You are inside this area. ':`In about ${zone.distanceM} meters: `)+zone.name+'. '+zone.description+' '+(zone.critical?'The walk is paused. ':'')+(avoiding?'This area is excluded from your plan. Follow the marked route.':state.offRoutePosition?'Return to the mapped route before planning a detour.':'Select “Find a safer route” to pause and compare plans outside the danger zones.');
    announce({key:zone.key,title:(zone.critical?'Restricted area · ':zone.phase==='inside'?'Caution area · ':'Nearby hazard · ')+zone.name,message,critical:zone.critical,zoneId:zone.id});
    if(zone.critical)break;
  }
}
function showGuidance(message){
  $('#navigation-cue').hidden=false;$('#navigation-message').textContent=message;
  if(state.voiceEnabled&&!state.nearHazard)speakMessage(message);
}
function guideRoute(){
  const p=state.progress;if(!p||!state.running||state.speaking)return;
  const b=p.path[p.index+1];if(!b)return;
  const remaining=edgeCost(p.path[p.index],b,result.speed,state.anchor)*(1-p.fraction);
  if(p.cueIndex===p.index||!shouldPrepareTurn(remaining,{caution:state.nearHazard}))return;
  p.cueIndex=p.index;
  const sector=sectors[state.sector],stop=sector.stops[b],next=p.path.slice(p.index+2).find(id=>sector.stops[id]||id==='base');
  showGuidance(b==='base'?'Approaching Ares Base. Follow the marked segment to complete your return.':stop?`Approaching ${stop.name}. Prepare for the observation.`:`At the next junction, follow the marked route toward ${sector.stops[next]?.name||'Ares Base'}.`);
}
function renderItinerary(){
  const sector=sectors[state.sector];
  const stop=(name,desc,tag,type,num,time='')=>`<div class="itinerary-stop ${type==='blocked'?'blocked':''}"><span class="stop-marker ${type==='base'?'base':''}">${type==='base'?icon('flag'):num}</span><div class="stop-details"><div><strong>${name}</strong><span class="stop-time">${time}</span></div><p>${desc}</p>${tag?`<span class="stop-tag ${type==='science'?'science':type==='alternative'?'pending':''}">${tag}</span>`:''}</div></div>`;
  let content=stop('Ares Base','Departure and return point','ARES BASE','base','',state.elapsed?'T+00':'09:00');
  let count=0;
  for(const id of state.selected){const data=sector.stops[id],completed=state.completed.includes(id),unavailable=!result.stops.includes(id)&&!completed;content+=stop(data.name,data.method,completed?'Observation recorded':unavailable?'No longer fits this plan':'On-site observation',unavailable?'blocked':'science',++count,`${data.duration} min`);}
  if(result.alternative)content+=stop(sector.stops.lookout.name,'View and features need verification','SCIENCE PENDING','alternative',++count,'5 min');
  content+=stop('Return to base',`Estimated reserve: ${fmt(result.reserve)}`,'','base','',fmt(result.totalTime));
  $('#itinerary').innerHTML=content;
}
function xy(id){const n=nodeById(id,state.anchor);return [n.x*10,n.y*7.5];}
function pointString(path){return path.map(id=>xy(id).join(',')).join(' ');}
function renderMap(){
  const s=sectors[state.sector], svg=$('#map-svg'),width=$('#map-viewport').clientWidth||800,compact=width<600,labelFont=Math.max(19,15*1000/width),hitRadius=Math.max(26,22*1000/width);
  let out=`<defs><pattern id="grid" width="100" height="75" patternUnits="userSpaceOnUse"><path d="M100 0H0V75" fill="none" stroke="#f0e4c7" stroke-opacity=".09" stroke-width="1"/></pattern><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V10" stroke="#d4b38d" stroke-width="2" stroke-opacity=".35"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity=".8"/></filter></defs><rect width="1000" height="750" fill="url(#grid)"/>`;
  if(state.view==='contours')out+=`<g fill="none" stroke="#e9d6ae" stroke-opacity=".28" stroke-width="1">${contourPaths}</g>`;
  if(state.layers.hazards)out+=activeHazards().map(zone=>`<g><title>${escapeHTML(zone.name+': '+zone.description)}</title><ellipse cx="${zone.x*10}" cy="${zone.y*7.5}" rx="${zone.radiusM}" ry="${zone.radiusM*.75}" fill="${zone.kind==='caution'?'#d5b47744':'url(#hatch)'}" stroke="#d7b36e" stroke-width="2.5"/><text x="${zone.x*10}" y="${zone.y*7.5+9}" text-anchor="middle" font-size="${labelFont*1.3}" font-family="Arial" font-weight="bold" fill="#e8d5b0" stroke="#543d26" stroke-width="1">!</text><text x="${zone.x*10}" y="${zone.y*7.5+zone.radiusM*.75+labelFont+5}" text-anchor="middle" font-size="${labelFont*.8}" fill="#fff3d7" stroke="#312b2c" stroke-width="5" paint-order="stroke">${escapeHTML(zone.name)} · ${zone.kind==='caution'?'caution':'no entry'}</text></g>`).join('');
  if(state.layers.corridors)out+=`<g stroke="#c8c8aa" stroke-opacity=".34" stroke-width="1.5" stroke-dasharray="5 7">${edges.map(([a,b])=>`<path d="M${xy(a)} ${xy(b)}"/>`).join('')}</g>`;
  if(state.layers.reach)out+=`<g stroke="#b2bca6" stroke-opacity=".20" stroke-width="27" stroke-linecap="round">${result.reachableEdges.map(([a,b])=>`<path d="M${xy(a)} ${xy(b)}"/>`).join('')}</g>`;
  if(state.event){const original=calculate({sector:state.sector,selected:state.selected,extraLoadKg:state.extraLoadKg});out+=`<polyline points="${pointString(original.path)}" fill="none" stroke="#d7c3a0" stroke-width="2" stroke-dasharray="5 8" opacity=".35"/>`;}
  const displayPoints=state.navigationDemo?state.navigationDemo.originalPoints.map(point=>point.join(',')).join(' '):pointString(result.path);
  if(!state.navigationDemo&&state.deviation?.originalPoints)out+='<polyline class="original-route" points="'+state.deviation.originalPoints.map(point=>point.join(',')).join(' ')+'" fill="none" stroke="'+state.deviation.originalColor+'" stroke-width="3" stroke-dasharray="8 9" opacity=".35"/>';
  out+=`<polyline class="map-route" points="${displayPoints}" fill="none" stroke="#1b211b" stroke-width="9" opacity=".5" stroke-linejoin="round"/><polyline points="${displayPoints}" fill="none" stroke="${result.viable?'var(--route-color)':'#ca9690'}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" ${state.proposal?'stroke-dasharray="9 6"':''}/>`;
  // Small direction chevrons make the outbound and homeward corridors readable.
  for(let i=1;!state.navigationDemo&&i<result.path.length;i++){const [a,b]=[xy(result.path[i-1]),xy(result.path[i])],x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;out+=`<path d="m-4-4 5 4-5 4" transform="translate(${x},${y}) rotate(${angle})" fill="none" stroke="var(--route-color)" stroke-width="1.8"/>`;}
  for(const n of nodes){const [x,y]=xy(n.id),science=!!s.stops[n.id],isBase=n.id==='base',name=isBase?'ARES BASE':s.stops[n.id]?.name;const active=state.selected.includes(n.id)||(n.id==='lookout'&&result.alternative),reachable=result.reachable.includes(n.id),blocked=result.blocked.includes(n.id);const color=blocked?'#ca9690':active?'var(--route-color)':reachable?'#c4d0ad':'#a6a991';
    out+=`<g class="map-node" data-node="${n.id}" tabindex="0" role="button" aria-label="${name||'Corridor '+n.id}${reachable?', viable return':', outside return range'}" transform="translate(${x},${y})"><circle class="node-hit" r="${hitRadius}" fill="transparent"/>`;
    if(isBase){out+=`<rect x="-15" y="-15" width="30" height="30" rx="7" fill="#243027" stroke="#c4d0ad" stroke-width="1.5"/><path d="m-7 1 7-7 7 7v7H-7V1Zm5 7V2h4v6" fill="none" stroke="#e1e8cc" stroke-width="1.5"/>`;}
    else if(science){out+=`<circle class="node-core" r="${active?11:8}" fill="${active?'var(--route-color)':'#303c2b'}" stroke="${color}" stroke-width="2"/><circle r="3" fill="${active?'#513426':color}"/>`;}
    else out+=`<circle class="node-core" r="4" fill="#4e5941" stroke="${color}" stroke-width="1.5"/>`;
    if(state.layers.labels&&name){const isLookout=n.id==='lookout',isRight=n.id==='skinner',labelX=isRight?-22:22,labelY=isLookout?labelFont+20:-22;out+=`<g filter="url(#shadow)"><text x="${labelX}" y="${labelY}" text-anchor="${isRight?'end':'start'}" fill="#fff7eb" font-family="Arial,sans-serif" font-size="${labelFont}" font-weight="600">${escapeHTML(name)}</text>${compact?'':`<text x="${labelX}" y="${labelY+24}" text-anchor="${isRight?'end':'start'}" fill="${color}" font-family="Arial,sans-serif" font-size="${labelFont*.7}">${isBase?'Departure and return':blocked?'Access closed':isLookout?'View needs validation':n.id==='wildcat'?'First observation':'Second observation'}</text>`}</g>`;}
    out+='</g>';
  }
  if(state.deviation?.sector===state.sector)out+='<polyline points="'+state.deviation.wrongTurn.map(point=>point.join(',')).join(' ')+'" fill="none" stroke="#ff9ab5" stroke-width="8" stroke-dasharray="7 5"><title>Simulated missed turn</title></polyline>';
  if(state.deviation?.returnPoints){
    const target=state.deviation.returnPoints[1];
    out+='<g class="return-guidance"><polyline points="'+state.deviation.returnPoints.map(point=>point.join(',')).join(' ')+'" fill="none" stroke="#ffbd73" stroke-width="6" stroke-dasharray="9 5"/><circle cx="'+target[0]+'" cy="'+target[1]+'" r="18" fill="#ffbd7333" stroke="#ffbd73" stroke-width="3"/><text x="'+(target[0]+25)+'" y="'+(target[1]+25)+'" font-size="20" font-family="Arial" fill="#ffbd73" stroke="#171024" stroke-width="5" paint-order="stroke">Return here</text></g>';
  }
  out+=teamMapLayer();
  const pos=state.offRoutePosition?[state.offRoutePosition.x*10,state.offRoutePosition.y*7.5]:state.progress?.position||xy(state.current);out+=`<g id="crew-position" transform="translate(${pos})"><circle class="crew-pulse" r="25" fill="${activeProfile().color}" opacity=".3"/><circle r="${Math.max(11,8*1000/width)}" fill="${activeProfile().color}" stroke="#fff" stroke-width="3"/><path d="m-4 3 4-9 4 9-4-2Z" fill="#171024"/><text x="0" y="${-labelFont-9}" text-anchor="middle" font-size="${labelFont*.8}" font-family="Arial" fill="#f5efff" stroke="#171024" stroke-width="5" paint-order="stroke">${escapeHTML(activeCode)}</text></g>`;
  if(state.layers.labels)out+=`<text x="120" y="310" transform="rotate(-32 120 310)" fill="#e8e2c0" opacity=".16" font-family="Arial,sans-serif" font-size="18" letter-spacing="7">${state.sector==='jezero'?'HAWKSBILL GAP':'MONTE SHARP'}</text><text x="635" y="640" fill="#e8e2c0" opacity=".2" font-family="Consolas,monospace" font-size="10" letter-spacing="4">${state.sector==='jezero'?'DELTA FRONT':'BOXWORK'}</text>`;
  svg.innerHTML=out+'<g id="echo-layer" pointer-events="none" aria-hidden="true"></g>';
  $$('[data-node]').forEach(el=>{el.addEventListener('click',()=>showNode(el.dataset.node));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showNode(el.dataset.node);}});});
  if(state.echoEnabled)renderEcho(true);
}
function renderEcho(force=false){
  $('#echo-panel').hidden=!state.echoEnabled;
  $('#echo-button').setAttribute('aria-pressed',String(state.echoEnabled));
  $('#map-viewport').classList.toggle('echo-open',state.echoEnabled);
  if(!state.echoEnabled){if($('#echo-layer'))$('#echo-layer').innerHTML='';return;}
  const clock=performance.now();if(!force&&clock-lastEchoAt<400)return;lastEchoAt=clock;
  const forecast=returnEcho({sector:state.sector,event:state.event,dust:state.dust,budget:state.budget,minReserve:state.minReserve,elapsed:state.elapsed,current:state.current,anchor:state.anchor,progress:state.progress,completed:state.completed,extraLoadKg:state.extraLoadKg,avoidedHazards:state.avoidedHazards,preferredPath:state.chosenRoute?.path,selected:state.finished?[]:(state.approvedStops??state.selected).filter(id=>!state.completed.includes(id)),mobility:operationalMobility(state.health)},state.echoHorizon);
  $('#echo-horizon').textContent=`${state.echoHorizon} min`;
  $('#echo-now-time').textContent=fmt(forecast.now.time)+' to base';
  $('#echo-later-time').textContent=fmt(forecast.later.time)+' to base';
  const margin=n=>Number.isFinite(n)?`${Math.floor(n)} min left on arrival`:'No return available';
  $('#echo-now-reserve').textContent=margin(forecast.now.reserve);
  $('#echo-later-reserve').textContent=margin(forecast.later.reserve);
  $('#echo-status').textContent=forecast.later.viable?`You would reach base with ${Math.floor(forecast.later.reserve)} min of margin.`:Number.isFinite(forecast.later.reserve)?`You would be ${Math.ceil(state.minReserve-forecast.later.reserve)} min below your minimum margin.`:'No return would be possible along the available corridors.';
  $('#echo-status').dataset.kind=forecast.later.viable?'viable':'limited';
  $('#echo-caption').textContent=`The dashed line is your way home from the ghost marker, ${forecast.advancedMin.toFixed(1)} mission min ahead${forecast.activity?' during an observation':''}. Preview only; your live route is unchanged.`;
  const path=forecast.later.path.map(id=>{const n=nodeById(id,forecast.anchor);return `${n.x*10},${n.y*7.5}`;}).join(' '),x=forecast.position.x*10,y=forecast.position.y*7.5;
  const stroke=forecast.later.viable?'var(--echo-map)':'#f4afb1';
  $('#echo-layer').innerHTML=`<polyline points="${path}" fill="none" stroke="#142b3a" stroke-width="9" opacity=".65"/><polyline points="${path}" fill="none" stroke="${stroke}" stroke-width="4" stroke-dasharray="10 8" stroke-linecap="round"/><g transform="translate(${x},${y})"><circle r="18" fill="#193647" fill-opacity=".85" stroke="${stroke}" stroke-width="2"/><path d="m-5 5 5-13 5 13-5-3Z" fill="${stroke}"/><text x="0" y="-29" text-anchor="middle" font-family="Arial" font-size="17" fill="#f5f9fc" stroke="#142b3a" stroke-width="4" paint-order="stroke">You, +${forecast.advancedMin.toFixed(1)} min</text></g>`;
}
function teamMapLayer(){
  let out='';
  for(const profile of profiles){
    const m=profile.code===activeCode?state:profile.mission;if(!m||m.sector!==state.sector)continue;
    const track=m.progress?[...m.track,m.progress.position]:m.track;
    out+='<polyline '+(profile.code===activeCode?'id="active-track"':'')+' points="'+track.map(point=>point.join(',')).join(' ')+'" fill="none" stroke="'+profile.color+'" stroke-width="5" stroke-linecap="round" opacity=".85"/>';
    if(profile.code===activeCode)continue;
    const path=m.progress?.path.slice(m.progress.index)??m.chosenRoute?.path;
    if(path&&path.every(id=>nodeById(id,m.anchor)))out+='<polyline points="'+path.map(id=>{const n=nodeById(id,m.anchor);return n.x*10+','+n.y*7.5;}).join(' ')+'" fill="none" stroke="'+profile.color+'" stroke-width="3" stroke-dasharray="9 7" opacity=".7"/>';
    const point=nodeById(m.current,m.anchor),pos=m.offRoutePosition?[m.offRoutePosition.x*10,m.offRoutePosition.y*7.5]:m.progress?.position||[point.x*10,point.y*7.5];
    out+='<g transform="translate('+pos+')"><title>'+escapeHTML(profile.name)+' · '+profile.code+' · paused</title>'+'<circle r="11"'+' fill="'+profile.color+'" stroke="#171024" stroke-width="3"/><text x="17" y="-16" fill="'+profile.color+'" stroke="#171024" stroke-width="5" paint-order="stroke" font-family="Arial" font-size="17">'+profile.code+'</text></g>';
  }
  return out;
}
function toggleEcho(){state.echoEnabled=!state.echoEnabled;if(state.echoEnabled){$('#map-tooltip').hidden=true;$('#layer-popover').hidden=true;}renderEcho(true);}
function placeTitle(id){return id==='base'?'Ares Base':sectors[state.sector].stops[id]?.name||({junction:'Corridor junction',crossing:'Corridor crossing',south:'Southern corridor',ridge:'Ridge corridor'}[id]||'Waypoint');}
function showNode(id){
  if(state.echoEnabled){state.echoEnabled=false;renderEcho(true);}
  const sector=sectors[state.sector],data=sector.stops[id],reachable=result.reachable.includes(id),n=nodeById(id);
  if(!n)return;
  $('#map-tooltip').innerHTML=`<strong>${id==='base'?'Ares Base':data?.name||'Waypoint'}</strong><p>${data?.question||'This waypoint belongs to the corridor connecting the stops to base.'}</p><p>${reachable?'You can return from here with the selected margin.':'This waypoint is outside return range with the selected margin.'}<br>Route elevation: +${n.z} m</p><div class="point-actions"><button class="point-data" data-action="place-data" data-place="${id}">View place facts ${icon('arrow')}</button><button data-action="hide-tooltip">Close</button></div>`;
  $('#map-tooltip').hidden=false;
}
function showPlaceData(id){
  const n=nodeById(id),sector=sectors[state.sector],info=placeFacts(state.sector,id);if(!n||!info)return;
  if(state.running){pause();record('Walk paused','Viewing place facts.');update();}
  const stop=sector.stops[id],name=placeTitle(id);
  openDialog(heading('DISCOVER MARS',name,info.scope)+placeGallery(info)+`<div class="place-mission"><span>ON YOUR WALK</span><strong>+${n.z} m relative elevation${stop?' · '+stop.duration+' min of observation':''}</strong><p>${stop?.method||'A connecting waypoint and landmark for your walk.'}</p></div><div class="place-facts">${info.facts.map(fact=>`<article class="place-fact"><span>DID YOU KNOW…?</span><h3>${fact.title}</h3><p>${fact.text}</p><a href="${fact.source}" target="_blank" rel="noreferrer">Read the story at NASA ↗</a></article>`).join('')}</div>`);
}
function renderElevation(){
  const p=state.progress,profile=elevationProfile({path:p?.path??result.path,anchor:state.anchor,segmentIndex:p?.index??0,fraction:p?.fraction??0});
  if(!profile||profile.points.length<2){$('#elevation-svg').innerHTML='';delete $('#elevation-svg').dataset.profileKey;$('#elevation-range').textContent=state.finished?'Walk completed':'You are at base';$('#elevation-live').textContent=state.finished?'You have completed your return.':'Plan a route to see its elevation.';return;}
  const maxZ=Math.max(profile.peak,1),total=profile.distance||1,toX=d=>10+d/total*300,toY=z=>80-z/maxZ*65,line=profile.points.map(pt=>`${toX(pt.distance)},${toY(pt.z)}`).join(' '),x=toX(profile.currentDistance),y=toY(profile.height);
  $('#elevation-svg').setAttribute('viewBox','0 0 320 94');
  $('#elevation-range').textContent=`Peak elevation: +${Math.round(profile.peak)} m relative to base`;
  $('#elevation-live').textContent=`Now: +${Math.round(profile.height)} m · ${(profile.remaining/1000).toFixed(2)} km left`;
  $('#profile-label').textContent=p?'Your position':'Route ready';
  $('#elevation-svg').setAttribute('aria-label',`Route elevation. Current height ${Math.round(profile.height)} meters.`);
  const key=JSON.stringify(profile.points),chart=$('#elevation-svg');
  // Keep the marker mounted so its light pulse continues between position updates.
  if(chart.dataset.profileKey!==key){
    chart.dataset.profileKey=key;
    chart.innerHTML=`<defs><linearGradient id="elev-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--orange)" stop-opacity=".18"/><stop offset="1" stop-color="var(--orange)" stop-opacity="0"/></linearGradient><clipPath id="elev-done"><rect id="elev-done-width" x="0" y="0" width="${x}" height="94"/></clipPath></defs><polygon points="10,94 ${line} 310,94" fill="url(#elev-fill)"/><polyline points="${line}" fill="none" stroke="var(--muted)" opacity=".35" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline points="${line}" fill="none" stroke="var(--orange)" stroke-width="2.5" clip-path="url(#elev-done)" vector-effect="non-scaling-stroke"/><path id="elevation-guide" d="M${x} ${y}V94" stroke="var(--orange)" stroke-opacity=".4" stroke-dasharray="3 4"/><g id="elevation-cursor" transform="translate(${x},${y})" aria-hidden="true"><circle class="elevation-halo" r="6"/><circle class="elevation-halo elevation-halo-delayed" r="6"/><circle id="elevation-position" r="5" fill="var(--orange)" stroke="var(--panel)" stroke-width="2"/></g>`;
  }
  $('#elevation-cursor').setAttribute('transform',`translate(${x},${y})`);
  $('#elev-done-width').setAttribute('width',x);
  $('#elevation-guide').setAttribute('d',`M${x} ${y}V94`);
}

// Code-generated relief: illustrative terrain only, never a scientific raster.
let contourPaths='';
function hash(x,y){const n=Math.sin(x*127.1+y*311.7+state.sector.length*19)*43758.5453;return n-Math.floor(n);}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;}
function terrainHeight(x,y){let value=0,amp=1,scale=3;for(let k=0;k<6;k++){value+=noise(x*scale,y*scale)*amp;scale*=2.1;amp*=.49;}const ridge=Math.abs(Math.sin(x*8+y*3+noise(x*4,y*4)*3));return value*.7+Math.pow(ridge,3)*.24+Math.sin(x*3-y*4)*.12;}
function drawTerrain(){
  const canvas=$('#terrain'),ctx=canvas.getContext('2d'),w=800,h=600;canvas.width=w;canvas.height=h;const data=ctx.createImageData(w,h),heights=new Float32Array((w+1)*(h+1));
  for(let y=0;y<=h;y++)for(let x=0;x<=w;x++)heights[y*(w+1)+x]=terrainHeight(x/w,y/h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const z=heights[y*(w+1)+x],dx=(heights[y*(w+1)+x+1]-z)*95,dy=(heights[(y+1)*(w+1)+x]-z)*95,shade=Math.max(.2,Math.min(1.65,.82+dx*.6-dy*.8)),grain=hash(x+200,y+450)*12;const i=(y*w+x)*4;data.data[i]=(109+z*46)*shade+grain;data.data[i+1]=(102+z*38)*shade+grain;data.data[i+2]=(77+z*28)*shade+grain;data.data[i+3]=255;}
  ctx.putImageData(data,0,0);
  // Marching squares contours, derived from the same illustrative height field.
  contourPaths='';const nx=70,ny=52;
  for(let level=.35;level<1.5;level+=.075){let path='';for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const corners=[[x/nx,y/ny],[(x+1)/nx,y/ny],[(x+1)/nx,(y+1)/ny],[x/nx,(y+1)/ny]],values=corners.map(([a,b])=>terrainHeight(a,b)),cross=[];for(let e=0;e<4;e++){const n=(e+1)%4;if((values[e]<level)!==(values[n]<level)){const t=(level-values[e])/(values[n]-values[e]);cross.push([(corners[e][0]+(corners[n][0]-corners[e][0])*t)*1000,(corners[e][1]+(corners[n][1]-corners[e][1])*t)*750]);}}for(let i=0;i+1<cross.length;i+=2)path+=`M${cross[i][0].toFixed(1)},${cross[i][1].toFixed(1)}L${cross[i+1][0].toFixed(1)},${cross[i+1][1].toFixed(1)}`;}contourPaths+=`<path d="${path}"/>`;}
}
function drawGlobe(){
  const c=$('#globe-canvas');if(!c)return;const ctx=c.getContext('2d'),size=420,r=172,img=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const nx=(x-size/2)/r,ny=(y-size/2)/r,d=nx*nx+ny*ny;if(d>1)continue;const nz=Math.sqrt(1-d),lon=Math.atan2(nx,nz)+globeAngle,lat=Math.asin(ny),land=noise((lon+5)*3,(lat+3)*4),detail=noise((lon+9)*12,(lat+4)*15);const shade=Math.max(.02,nx*(-.5)+ny*(-.35)+nz*.75),dust=.68+land*.5+detail*.12,i=(y*size+x)*4;img.data[i]=(190*dust+20)*shade;img.data[i+1]=(109*dust+12)*shade;img.data[i+2]=(68*dust+9)*shade;img.data[i+3]=Math.min(255,(1-d)*10000);}
  ctx.clearRect(0,0,size,size);ctx.putImageData(img,0,0);ctx.strokeStyle='#e6a57622';ctx.lineWidth=1;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(210,210+i*42,Math.sqrt(r*r-(i*42)**2),17,0,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.arc(210,210,r,0,Math.PI*2);ctx.strokeStyle='#e8b08b44';ctx.stroke();
  for(const p of [{name:'JEZERO',lon:.4,lat:-.28},{name:'GALE',lon:1.25,lat:.2}]){const a=p.lon-globeAngle;if(Math.cos(a)<0)continue;const x=210+Math.sin(a)*Math.cos(p.lat)*r,y=210+Math.sin(p.lat)*r;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.strokeStyle='#eec6a699';ctx.stroke();ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#ffd9b4';ctx.fill();ctx.font='17px Arial';ctx.fillText(p.name,x+18,y+3);}
}

function openDialog(content,wide=false){const d=$('#main-dialog');$('#dialog-content').innerHTML=content;d.style.width=wide?'min(900px,calc(100% - 36px))':'';if(!d.open)d.showModal();}
function heading(kicker,title,lead){return `<span class="dialog-eyebrow">${kicker}</span><h2 class="dialog-title">${title}</h2><p class="dialog-lead">${lead}</p>`;}
function freshMission(sector='jezero'){
  const mission=JSON.parse(JSON.stringify(emptyMission));mission.sector=sector;return mission;
}
function activeProfile(){return profiles.find(profile=>profile.code===activeCode)||{code:'EVA-01',name:'Explorer 01',kind:'astronaut',color:'#d3b5ff'};}
function initializeProfiles(){
  const saved=loadProfiles(storage);profiles=saved?.profiles||[createProfile({code:'EVA-01',name:'Explorer 01'})];activeCode=saved?.activeCode||profiles[0].code;
  for(const profile of profiles){
    const mission=profile.mission;
    if(!mission||!sectors[mission.sector]||!Array.isArray(mission.selected)||!mission.selected.every(id=>sectors[mission.sector].stops[id])||!Array.isArray(mission.logs)||!Array.isArray(mission.track)||!Number.isFinite(mission.elapsed)||mission.elapsed<0||!Number.isFinite(mission.budget)||!nodeById(mission.current,mission.anchor))profile.mission=freshMission();
    else {profile.mission={...freshMission(),...mission,avoidedHazards:Array.isArray(mission.avoidedHazards)?mission.avoidedHazards.filter(id=>hazardsFor(mission).some(zone=>zone.id===id)):[],extraLoadKg:carriedLoad(mission.extraLoadKg).kg,minReserve:20,running:false,speaking:false,automaticVoice:false,nearHazard:false,activeNotice:null};}
  }
  state=activeProfile().mission;
}
function persistMission(throttle=false){
  if(!profiles.length)return;
  activeProfile().mission=state;
  if(throttle&&performance.now()-lastSavedAt<1000)return;
  lastSavedAt=performance.now();
  savedLocally=saveProfiles(storage,profiles,activeCode);
}
function renderProfileBar(){
  const profile=activeProfile();
  $('#active-profile-name').textContent=profile.name;$('#active-profile-code').textContent=profile.code+' · Astronaut';
  $('#profile-count').textContent=String(profiles.length);
  $('.crew-avatars').innerHTML=profiles.map(p=>'<button data-action="select-profile" data-code="'+p.code+'" aria-label="Switch to '+escapeHTML(p.name)+' ('+p.code+')" aria-pressed="'+(p.code===activeCode)+'" title="'+escapeHTML(p.name)+' · '+p.code+'" style="--profile-color:'+p.color+'">'+escapeHTML(p.name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase())+'</button>').join('');
  $('#profile-tracks').innerHTML=profiles.map(p=>'<span class="profile-key" style="--profile-color:'+p.color+'"><i></i>'+p.code+(p.code===activeCode?' · active':' · '+(p.mission?.sector===state.sector?'paused':'other area'))+'</span>').join('');
  $('.top-status').innerHTML='<span class="status-dot"></span> '+profile.code+' · '+(state.running?'In motion':'Standing by');
}

function showProfiles(){
  if(state.running){pause();record('Walk paused','Opening astronaut profiles.');update();}
  openDialog(heading('SURFACE TEAM','Who is exploring?','Each astronaut has a separate route, equipment load and mission history.')+
    '<div class="profile-list">'+profiles.map(p=>'<button class="profile-choice" data-action="select-profile" data-code="'+p.code+'" aria-pressed="'+(p.code===activeCode)+'" style="--profile-color:'+p.color+'"><span class="profile-mark">A</span><span><strong>'+escapeHTML(p.name)+'</strong><small>'+p.code+' · '+sectors[p.mission?.sector||'jezero'].name+' · '+(p.mission?.extraLoadKg||0)+' kg extra</small></span><span>'+(p.code===activeCode?'Active':'Switch')+'</span></button>').join('')+'</div>'+
    '<details class="add-profile"><summary>Add an astronaut</summary><form id="profile-form"><div class="profile-fields astronaut-fields"><label>Call sign<input name="name" maxlength="40" placeholder="e.g. Explorer 02" required></label><label>Unique code<input name="code" minlength="2" maxlength="16" pattern="[A-Za-z0-9][A-Za-z0-9-]{1,15}" placeholder="e.g. EVA-02" required></label></div><p id="profile-error" role="status"></p><button class="primary-button" type="submit">Add and switch</button></form></details><p class="dialog-tip">Switching pauses the current astronaut. Use the circles below the side panel to switch quickly. '+(savedLocally?'Saved in this browser on this device.':'Browser storage is unavailable; profiles last for this session only.')+'</p>',true);
  $('#profile-form').addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(event.target);
    try{addProfile({code:data.get('code'),name:data.get('name')});}catch(error){$('#profile-error').textContent=error.message;}
  });
}

function addProfile(parameters){
  if(profiles.length>=12)throw new Error('This team already has 12 profiles.');
  pause();const profile=createProfile(parameters,profiles);profile.mission=freshMission(state.sector);profiles.push(profile);switchProfile(profile.code);showDestinations();
}
function switchProfile(code){
  if(!profiles.some(p=>p.code===code))return;
  pause();persistMission();
  if('speechSynthesis' in window){speechSequence++;window.speechSynthesis.cancel();}
  activeCode=code;state=activeProfile().mission;state.speaking=false;state.running=false;
  notices.reset();proximityMonitor.reset();clearTimeout(riskTimer);$('#risk-alert').hidden=true;$('#navigation-cue').hidden=true;
  $('#main-dialog').close();$('#map-tooltip').hidden=true;applyTransform();drawTerrain();update();persistMission();
}
function freezePosition(){
  pause();
  if(state.navigationDemo){state.navigationDemo=null;state.rerouteNotice=null;record('Deviation simulation interrupted','Mission planning continues from the actual current position.');}const p=state.progress,remaining=p?(p.fraction>0?['crew',...p.path.slice(p.index+1)]:p.path.slice(p.index)):null;
  capturePosition();state.progress=null;
  if(state.chosenRoute&&remaining)state.chosenRoute={...state.chosenRoute,path:remaining};
  return remaining||state.chosenRoute?.path||getResult().path;
}
function renderConditions(){
  const weather=scenarioWeather(state.sector,{elapsedMin:elapsedNow(),dust:state.dust});
  $('#weather-temperature').textContent=weather.temperatureC.toFixed(1)+' °C';
  $('#weather-condition').textContent=weather.condition;
  $('#weather-wind').textContent=weather.windMps.toFixed(1)+' m/s';
  $('#weather-visibility').textContent=weather.visibility;
  $('#extra-load-value').textContent=state.extraLoadKg+' kg';
  $('#extra-load-button').disabled=state.finished;
  if(state.offRoutePosition)$('#extra-load-button').disabled=true;
  $('#route-choice-button').disabled=Boolean(state.offRoutePosition);
  const warning=$('#load-warning');
  warning.hidden=state.extraLoadKg===0||result.loadRisk==='normal';
  warning.dataset.kind=result.loadRisk;
  warning.textContent=!result.viable?'No viable return with this load and mission time. Reduce equipment weight or adjust mission time before continuing.':!result.nominalViable?'This load makes the requested route exceed the return time buffer. Review a shorter route before continuing.':`Extra equipment slows your pace to ${result.speed.toFixed(1)} m/min. Allow about ${Math.ceil(result.loadPenaltyMin)} more min than with the suit alone.`;
  $('#deviation-button').disabled=state.finished||!state.chosenRoute||state.proposal||!result.viable||Boolean(state.navigationDemo);
  $('#echo-button').disabled=Boolean(state.navigationDemo);
}
function assessLoad(kg){
  const parameters=routeParameters(),preferredPath=state.chosenRoute?.path;
  const previous=calculate({...parameters,preferredPath});
  const loaded=calculate({...parameters,preferredPath,extraLoadKg:kg});
  const direct=calculate({...parameters,extraLoadKg:kg,selected:[],preferredPath:null});
  return {kg,beforeKg:state.extraLoadKg,beforeMin:previous.nominal.time,timeMin:loaded.nominal.time,deltaMin:loaded.nominal.time-previous.nominal.time,marginMin:loaded.nominalReserve,returnMin:direct.time,returnViable:direct.viable,viable:loaded.nominalViable,risk:loaded.loadRisk,speed:loaded.speed};
}
function loadImpactHTML(review){
  const time=Number.isFinite(review.timeMin)?Math.round(review.timeMin)+' min':'No available path';
  const delta=Number.isFinite(review.deltaMin)?(review.deltaMin>=0?'+':'')+Math.round(review.deltaMin)+' min vs current load':'Time needs review';
  return '<div class="load-impact-stats"><div><strong>'+time+'</strong><span>Requested route from here</span></div><div><strong>'+review.speed.toFixed(1)+' m/min</strong><span>Estimated walking pace</span></div></div><p>'+delta+'. Travel, observations and return are included.</p><p class="load-impact-message" data-kind="'+review.risk+'">'+(!review.returnViable?'Warning: even a direct return exceeds the mission time buffer. Reduce the extra load or adjust mission time.':!review.viable?'Warning: the requested route no longer preserves the return time buffer. A shorter itinerary is needed.':review.risk==='caution'?'Caution: allow more time for this load and review your remaining margin.':'The requested route fits the mission time with the return buffer.')+'</p>';
}
function showLoadReport(){
  if(state.finished)return;
  freezePosition();update();
  openDialog(heading('EQUIPMENT REPORT','Are you carrying extra weight?','Report equipment or samples in addition to your suit. The remaining route is recalculated from your current position.')+
    '<form id="load-form"><label class="load-field" for="extra-load-input">Extra equipment (kg)<input id="extra-load-input" name="load" type="number" min="0" max="80" step="0.1" required value="'+state.extraLoadKg+'"><small>0 means the suit alone. Scenario range: 0–80 kg.</small></label><div id="load-impact" aria-live="polite">'+loadImpactHTML(assessLoad(state.extraLoadKg))+'</div><p class="dialog-tip">This is a scenario estimate, not a validated EVA carrying limit.</p><div class="dialog-actions"><button class="primary-button" type="submit">Report load and recalculate</button></div></form>');
  $('#extra-load-input').addEventListener('input',event=>{
    const kg=Number(event.target.value);
    if(Number.isFinite(kg)&&kg>=0&&kg<=80)$('#load-impact').innerHTML=loadImpactHTML(assessLoad(kg));
  });
  $('#load-form').addEventListener('submit',event=>{event.preventDefault();applyExtraLoad(Number(new FormData(event.target).get('load')));});
}
function applyExtraLoad(kg){
  if(!Number.isFinite(kg)||kg<0||kg>80){notify('Enter extra equipment between 0 and 80 kg.');return;}
  if(state.finished)return;
  freezePosition();const review=assessLoad(kg);
  state.extraLoadKg=kg;invalidate();state.proposal=true;state.loadReview=review;
  record('Extra equipment reported',`${review.beforeKg} → ${kg} kg in addition to the suit. Requested route: ${fmt(review.timeMin)}; pace ${review.speed.toFixed(1)} m/min. ${review.viable?'Fits the return buffer.':'Time risk: requested route no longer fits the return buffer.'}`);
  update();
  openDialog(heading('LOAD REPORTED',review.viable?'Your walking time has been updated.':'Your route needs a time review.',kg+' kg of extra equipment is now included. The walk is paused.')+
    loadImpactHTML(review)+'<div class="dialog-actions"><button class="primary-button" data-action="routes">Review revised routes</button><button class="outline-button" data-action="load">Change equipment weight</button></div>');
}
function renderRerouteNotice(){
  const notice=state.rerouteNotice;$('#reroute-notice').hidden=!notice;
  $('#map-viewport').classList.toggle('deviation-open',Boolean(notice));
  if(!notice)return;
  const titles={approach:'Approaching a deviation',departing:'You are leaving your route',alternative:'Alternative route found',return:'No alternative · turn back',returning:'Returning to your route',restored:'Back on your route',critical:'Stop and review your return'};
  const title=titles[notice.kind]||'Route guidance';
  $('#reroute-notice').dataset.kind=notice.kind;
  if($('#reroute-title').textContent!==title)$('#reroute-title').textContent=title;
  if($('#reroute-message').textContent!==notice.message)$('#reroute-message').textContent=notice.message;
  const demo=state.navigationDemo;
  $('#deviation-distance').textContent=demo?.departedM>0?Math.round(demo.departedM)+' m along the side corridor':'';
  $('#return-to-route-button').hidden=demo?.phase!=='awaiting-return';
  $('#dismiss-deviation-button').hidden=Boolean(demo);
}

function simulateDeviation(){
  if(state.finished||state.navigationDemo||!state.chosenRoute||state.proposal||!result.viable)return;
  unlockSound();
  const resumeAfter=state.running,path=freezePosition(),before=getResult();
  const planned=missedTurn({path,current:state.current,anchor:state.anchor,speed:before.speed,blocked:before.blocked,avoidZones:before.avoidZones,selected:state.approvedStops??before.stops,completed:state.completed,sector:state.sector});
  if(!planned){notify('There is no mapped side corridor for this simulation at the current position.');return;}
  const originalPoints=path.map(id=>xy(id));
  state.navigationDemo={phase:planned.segments[0].phase,segments:planned.segments,index:0,fraction:0,branchIndex:planned.branchIndex,originalPath:[...path],originalRoute:JSON.parse(JSON.stringify(state.chosenRoute)),originalPoints,originalCurrent:state.current,originalAnchor:state.anchor?{...state.anchor}:null,offCorridor:planned.offCorridor||false,stops:[...(state.approvedStops??before.stops)],plannedAnchor:planned.anchor,resumeAfter,departedM:0,warned:false};
  state.deviation={sector:state.sector,originalPoints,originalColor:state.chosenRoute.color,wrongTurn:[planned.wrongTurn[0],planned.wrongTurn[0]]};
  state.echoEnabled=false;state.rerouteNotice={kind:state.navigationDemo.phase==='departing'?'departing':'approach',message:state.navigationDemo.phase==='departing'?'You are moving away from your selected route. Checking whether another corridor can reach your remaining stops.':'Watch the astronaut reach the next junction and then take a different corridor.'};
  record('Deviation simulation started','The astronaut will visibly leave the chosen route. Travel distance and mission time accumulate during the movement.');
  runNavigationDemo();
}
function renderDemoStatus(){
  const demo=state.navigationDemo;if(!demo)return;
  const waiting=demo.phase==='awaiting-return';
  $('#walk-state').textContent=waiting?'Return to your route':!state.running?'Deviation paused':demo.phase==='returning'?'Returning to the route':demo.phase==='departing'?'Leaving the route':'Approaching the junction';
  $('#next-action').textContent=waiting?'No alternative can reach your remaining stops. Turn back along the amber line.':demo.phase==='returning'?'Follow the amber line back to the last junction.':'Watch your position on the map. Navigation will show an alternative or ask you to turn back.';
  $('#walk-position').textContent=waiting?'You are off the selected route. Return to the indicated point.':!state.running?'The simulation is paused at your actual position.':'Your position is moving along the highlighted simulation trace.';
  $('#start-button').disabled=state.health.stale;
  $('#start-button').innerHTML=icon(state.running?'pause':'play')+'<span>'+(waiting?'Return to your route':state.running?'Pause simulation':'Continue simulation')+'</span>';
  $('#decision-actions').hidden=true;
}
function runNavigationDemo(){
  const demo=state.navigationDemo;if(!demo||demo.phase==='awaiting-return')return;
  clearInterval(timer);state.running=true;let previous=performance.now();update();
  timer=setInterval(()=>{
    if(!state.navigationDemo||!state.running)return;
    const now=performance.now(),dt=Math.max(0,Math.min(250,now-previous));previous=now;
    const simulation=state.navigationDemo,segment=simulation.segments[simulation.index];
    const seconds=segment.phase==='approach'?Math.max(.8,Math.min(4,segment.distanceM/90)):4;
    const next=Math.min(1,simulation.fraction+dt/1000/seconds),delta=next-simulation.fraction;
    simulation.fraction=next;simulation.phase=segment.phase;
    const point=segmentPosition(segment,next);
    if(segment.offCorridor)state.offRoutePosition=point.unmapped?{x:point.x,y:point.y,z:point.z}:null;
    else {state.current=point.current;state.anchor=point.anchor;}
    state.elapsed+=segment.timeMin*delta;state.traveledM+=segment.distanceM*delta;
    state.track.push([point.x*10,point.y*7.5]);
    const speed=getResult().speed;
    state.physiology=advancePhysiology(state.physiology,{dtMin:segment.timeMin*delta,walking:true,speedMMin:speed,extraLoadKg:state.extraLoadKg});
    if(segment.phase==='departing'){
      simulation.departedM=segment.distanceM*next;
      state.deviation.wrongTurn[1]=[point.x*10,point.y*7.5];
      if(!simulation.warned){
        simulation.warned=true;
        state.rerouteNotice={kind:'departing',message:'You are leaving your selected route. Checking alternative corridors to your remaining stops.'};
        record('Off-route warning','The astronaut is moving down a side corridor. Checking alternatives without dropping the remaining observation stops.');
        soundAlarm(false);speakMessage(state.rerouteNotice.message);
      }
    }
    if(next>=1-1e-9){
      if(segment.phase==='approach'&&simulation.stops.includes(state.current)&&!state.completed.includes(state.current)){
        const stop=sectors[state.sector].stops[state.current];state.completed.push(state.current);state.elapsed+=stop.duration;
        state.physiology=advancePhysiology(state.physiology,{dtMin:stop.duration,taskLoad:.25});record('Stop completed',stop.name+' · observation time included.');
      }
      simulation.index++;simulation.fraction=0;
      if(simulation.index===simulation.segments.length){
        if(segment.phase==='returning')finishReturnToRoute(simulation);else resolveNavigationDeviation(simulation);
        return;
      }
    }
    update();
  },PLAYBACK.tickMs);
}
function resolveNavigationDeviation(demo){
  pause();
  const selected=demo.stops.filter(id=>!state.completed.includes(id));
  const recovery=deviationRecovery({...routeParameters(),selected,completed:state.completed,speed:getResult().speed},{anchor:state.anchor,offCorridor:demo.offCorridor,segment:demo.segments.at(-1)});
  if(recovery.kind==='alternative'){
    state.navigationDemo=null;
    routeDrafts=recovery.options.map((route,index)=>({...route,color:['#51dccb','#ffbd73','#c4a0ff'][index],name:index===0?'Alternative route':route.name}));
    chooseRoute(0);state.routeDecisions.at(-1).trigger='off-route alternative';
    state.rerouteNotice={kind:'alternative',message:'An alternative reaches your remaining stops. Follow the teal line toward '+waypointName(state.chosenRoute.path[1],state.sector)+'. '+Math.round(result.time)+' min remaining; '+Math.floor(result.reserve)+' min left on return.'};
    record('Alternative route activated',state.rerouteNotice.message);
    if(demo.resumeAfter)toggleWalk();
  }else{
    demo.phase='awaiting-return';demo.returnSegment=recovery.segment;demo.returnTo=recovery.returnTo;
    const from=nodeById(recovery.returnTo,state.anchor);
    state.deviation.returnPoints=[state.track.at(-1),[from.x*10,from.y*7.5]];
    state.rerouteNotice={kind:'return',message:demo.offCorridor?'You have left the mapped corridors. No verified alternative is available here. Turn back along the amber trace to your last position on the original route.':'No viable alternative continues to your remaining stops from this side corridor. Turn back to '+waypointName(recovery.returnTo,state.sector)+' along the amber line to rejoin your original route.'};
    record('Return to route requested',state.rerouteNotice.message);
  }
  update();speakMessage(state.rerouteNotice.message);persistMission();
}
function returnToRoute(){
  const demo=state.navigationDemo;if(demo?.phase!=='awaiting-return')return;
  demo.phase='returning';demo.segments=[demo.returnSegment];demo.index=0;demo.fraction=0;
  state.rerouteNotice={kind:'returning',message:'Retrace the amber line back to your original route.'};
  record('Returning to route',state.rerouteNotice.message);runNavigationDemo();
}
function finishReturnToRoute(demo){
  pause();state.navigationDemo=null;state.offRoutePosition=null;state.anchor=demo.offCorridor?demo.originalAnchor:null;state.current=demo.returnTo;
  const selected=demo.stops.filter(id=>!state.completed.includes(id));
  const path=demo.offCorridor?[...demo.originalPath]:demo.originalPath.slice(demo.branchIndex).filter(id=>id!=='crew'),parameters={...routeParameters(),selected,preferredPath:path};
  const restored=calculate(parameters);
  if(restored.nominalViable){
    state.chosenRoute={...demo.originalRoute,path,distance:restored.distance,time:restored.time,stops:selected};
    state.approvedStops=selected;state.proposal=false;state.decision='accepted';state.revision++;
    state.rerouteNotice={kind:'restored',message:'You are back on your original route. Follow it toward '+waypointName(path[1],state.sector)+'. Continue when ready.'};
  }else{
    const home=calculate({...parameters,selected:[],preferredPath:null});
    state.chosenRoute={...demo.originalRoute,path:home.path,distance:home.distance,time:home.time,stops:[],name:'Return to base',color:'#ffbd73'};
    state.approvedStops=[];state.proposal=false;state.decision='accepted';state.revision++;
    state.rerouteNotice={kind:home.viable?'restored':'critical',message:home.viable?'You are back on the original corridor. The observations no longer fit the time available. Return to base along the amber line.':'You are back on the original corridor. The return time buffer cannot be met. Stay paused and review mission time before continuing.'};
  }
  delete state.deviation.returnPoints;
  record('Original route rejoined',state.rerouteNotice.message);update();speakMessage(state.rerouteNotice.message);persistMission();
}

function routeParameters(){return {...state,elapsed:state.elapsed,mobility:operationalMobility(state.health),selected:(state.approvedStops??state.selected).filter(id=>!state.completed.includes(id))};}
function routeMiniMap(route){
  const coords=route.path.map(id=>{const n=nodeById(id,state.anchor);return n.x*10+','+n.y*7.5;}).join(' ');
  return '<svg class="route-mini-map" viewBox="0 0 1000 750" role="img" aria-label="'+escapeHTML(route.name)+' corridor preview"><g stroke="currentColor" opacity=".18">'+edges.map(([a,b])=>'<path d="M'+xy(a)+' '+xy(b)+'"/>').join('')+'</g><polyline points="'+coords+'" fill="none" stroke="'+route.color+'" stroke-width="16" stroke-linejoin="round"/><circle cx="150" cy="577.5" r="22" fill="'+route.color+'"/></svg>';
}
function showRoutes(){
  freezePosition();update();
  routeDrafts=routeOptions(routeParameters());
  const avoiding=state.avoidedHazards.length>0;
  const safetyNote=avoiding?'<div class="route-safety-summary" role="status"><strong>Avoiding dangerous terrain</strong><p>'+activeHazards().filter(zone=>state.avoidedHazards.includes(zone.id)).map(zone=>escapeHTML(zone.name+': '+zone.description)).join('<br>')+'</p><p>Every option stays outside these areas. Check the observations included before choosing.</p></div>':'';
  if(!routeDrafts.length){openDialog(heading('ROUTE COMPARISON',avoiding?'No safe route available':'No feasible route yet',avoiding?'No mapped route avoids the danger zones within the available time. The walk stays paused. Review your mission time or stops.':'Increase the available mission time or change your stops.')+safetyNote+'<div class="dialog-actions"><button class="primary-button" data-action="settings">Adjust mission time</button><button class="outline-button" data-action="destinations">Change stops</button></div>');return;}
  openDialog(heading('CHOOSE YOUR ROUTE',avoiding?'Choose a route outside the danger zones':'One mission. Different ways there.','Recommended means the quickest feasible plan for the available stops, including the return. You choose the route.')+safetyNote+
    '<p class="route-scope">'+state.extraLoadKg+' kg extra equipment · '+escapeHTML(routeDrafts[0].scope)+'</p><div class="route-options">'+routeDrafts.map((route,index)=>
      '<article class="route-option" style="--option-color:'+route.color+'"><div class="route-option-heading"><span>ROUTE '+(index+1)+'</span>'+(route.recommended?'<b>Recommended</b>':'')+'</div>'+routeMiniMap(route)+'<h3>'+route.name+'</h3><p class="route-metrics">'+Math.round(route.time)+' min <span>·</span> '+(route.distance/1000).toFixed(2)+' km <span>·</span> '+Math.round(route.ascent)+' m climb</p><p>'+route.reason+'</p>'+(avoiding?'<p class="route-avoidance-note">'+escapeHTML(route.scope)+'</p>':'')+'<details><summary>What is along the way?</summary><p>'+route.encounterText+'</p><p>'+route.stops.map(id=>sectors[state.sector].stops[id].method).join(' · ')+'</p></details><button class="primary-button" data-action="choose-route" data-route="'+index+'">Choose route '+(index+1)+'</button></article>').join('')+'</div><p class="dialog-tip">Colored previews show different corridors in this scenario. Terrain and travel times are simulated. Fewer alternatives may be available under current conditions.</p>',true);
}
function chooseRoute(index){
  const route=routeDrafts[index];if(!route)return;
  const checked=calculate({...routeParameters(),selected:route.stops,preferredPath:route.path});
  if(!checked.viable||checked.path.join(',')!==route.path.join(',')){notify('Conditions changed. Compare the routes again.');showRoutes();return;}
  state.chosenRoute=JSON.parse(JSON.stringify(route));state.routeChoices=JSON.parse(JSON.stringify(routeDrafts));state.approvedStops=[...route.stops];
  state.proposal=false;state.decision='accepted';state.revision++;
  state.routeDecisions.push({time:new Date().toISOString(),sector:state.sector,chosenId:route.id,options:JSON.parse(JSON.stringify(routeDrafts))});
  record('Route selected',route.name+'. '+route.reason+' Along the way: '+route.encounterText);
  if(state.avoidedHazards.length){record('Hazard avoidance route selected',route.scope);state.activeNotice=null;clearTimeout(riskTimer);$('#risk-alert').hidden=true;}
  $('#main-dialog').close();update();notify('Route selected. '+(state.elapsed?'Continue':'Start')+' when ready.');
}
function renderRouteSummary(){
  const route=state.chosenRoute;
  $('#route-name').textContent=route?route.name:'Compare your routes';
  $('#route-summary').textContent=route?Math.round(result.time)+' min remaining · '+(result.distance/1000).toFixed(2)+' km · '+(route.recommended?'Recommended route':'Your selected alternative'):'Choose your observations, compare the options and select a route.';
  $('#route-swatch').style.background=route?.color||'#c4a0ff';
  $('#route-choice-button').textContent=route?'Change route':'Compare routes';
}
function showRestFeedback(){
  const feedback=state.restFeedback;if(!feedback)return;
  openDialog(heading('TWO-MINUTE CHECKPOINT','Take a breath. Look how far you have come.',feedback.summary)+
    '<div class="rest-stats"><div><strong>'+(feedback.distance/1000).toFixed(2)+' km</strong><span>Already traveled</span></div><div><strong>'+feedback.completed.length+'</strong><span>Observations completed</span></div><div><strong>'+fmt(feedback.returnTime)+'</strong><span>Direct return from here</span></div></div><div class="source-card"><h3>'+(feedback.completed.length?'What you have explored':'Your journey is underway')+'</h3><p>'+(feedback.completed.join(' · ')||'No observations completed yet. Your current position has been preserved.')+'</p><p>Two minutes have been added to mission time. Your next plan uses a reduced pace. Review it before continuing.</p></div><div class="dialog-actions"><button class="primary-button" data-action="routes">Compare routes from here</button><button class="outline-button" data-action="close-rest">Review return plan</button></div>');
}
function placeGallery(info){
  return '<div class="place-gallery">'+(info.photos||[]).map(photo=>{
    const crop=photo.crop,frameStyle='aspect-ratio:'+crop.width+'/'+crop.height+';--photo-width:'+(100*photo.width/crop.width).toFixed(4)+'%;--photo-left:'+(-100*crop.x/crop.width).toFixed(4)+'%;--photo-top:'+(-100*crop.y/crop.height).toFixed(4)+'%';
    return '<figure><a class="place-photo" href="'+photo.src+'" target="_blank" rel="noopener noreferrer" style="'+frameStyle+'" aria-label="Open original image: '+escapeHTML(photo.alt)+'"><img src="'+photo.src+'" alt="'+escapeHTML(photo.alt)+'" width="'+photo.width+'" height="'+photo.height+'"></a>'+
      '<div class="place-photo-tools"><span>Landscape detail</span><a href="'+photo.src+'" target="_blank" rel="noopener noreferrer">View original photo ↗</a></div>'+
      '<figcaption>'+photo.caption+' <a href="'+photo.source+'" target="_blank" rel="noreferrer">'+photo.credit+' ↗</a></figcaption></figure>';
  }).join('')+'</div>';
}
function teamReport(){
  return profiles.map(profile=>{
    const m=profile.code===activeCode?state:profile.mission,p=m.progress,r=calculate({...m,mobility:operationalMobility(m.health),selected:[]});
    const partial=p?.path[p.index+1]?edgeCost(p.path[p.index],p.path[p.index+1],r.speed,m.anchor)*p.fraction:0;
    return {code:profile.code,name:profile.name,kind:profile.kind,color:profile.color,sector:m.sector,sectorName:sectors[m.sector].name,elapsedMin:m.elapsed+partial,traveledM:m.traveledM,status:m.finished?'Completed':m.running?'In motion':p||m.elapsed?'Paused':'Not started',track:p?[...m.track,p.position]:m.track,routeDecisions:m.routeDecisions,events:m.logs,extraLoadKg:m.extraLoadKg||0,weather:scenarioWeather(m.sector,{elapsedMin:m.elapsed+partial,dust:m.dust})};
  });
}
function showGlobe(){
  openDialog(`<div class="globe-layout"><div class="globe-art"><canvas id="globe-canvas" width="420" height="420" aria-label="Illustrative Mars globe, drag to rotate"></canvas><span class="globe-caption">Drag to rotate the illustrative globe</span></div><div>${heading('EXPLORATION AREA','Where do you want to walk?','Choose one of the two areas to plan your walk.')}${Object.entries(sectors).map(([id,s])=>`<button class="sector-choice ${id===state.sector?'selected':''}" data-sector="${id}" aria-pressed="${id===state.sector}"><strong>${s.name} <span>↗</span></strong><span>${s.title} · ${s.coordinates}</span><span class="sector-state">${id===state.sector?'Your current area':'Choose this area'} · Local view</span></button>`).join('')}<p class="dialog-tip">Changing areas restarts the walk and activity model. Your history is kept. Waypoints and terrain are illustrative.</p></div></div>`,true);
  drawGlobe();const canvas=$('#globe-canvas');canvas.addEventListener('pointerdown',e=>{globeDrag=e.clientX;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(globeDrag!==null){globeAngle+=(e.clientX-globeDrag)/120;globeDrag=e.clientX;drawGlobe();}});canvas.addEventListener('pointerup',()=>globeDrag=null);canvas.addEventListener('pointercancel',()=>globeDrag=null);
}
function showSources(){openDialog(heading('SOURCES AND METHOD','Walk data','Mars Scouts uses local models and public references. No sensor or high-resolution map provider is connected.')+'<div class="source-card"><h3>Map reference · NASA Mars Trek</h3><p>The layers, elevation, scale and route layout take inspiration from Mars Trek. Mars Scouts terrain is illustrative and its corridor graph is synthetic; it has not been checked against NASA maps.</p><a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer">Open Mars Trek ↗</a><a href="https://trek.nasa.gov/mars/jpl/config/textAbout.html" target="_blank" rel="noreferrer">Mapping tools and products ↗</a></div><div class="source-card"><h3>Explorer activity model</h3><p>Heart rate and respiration respond to speed, slope, surface, workload and rest. Qualitative relationships refer to NASA EVA studies. The coefficients and individual are fictional and do not represent clinical predictions or human measurements on Mars. Suit respiratory support is assumed; SpO₂ and suit oxygen are separate variables.</p><a href="https://ntrs.nasa.gov/citations/20240001423" target="_blank" rel="noreferrer">Workload during EVA traverses ↗</a><a href="https://ntrs.nasa.gov/citations/20210024317" target="_blank" rel="noreferrer">Heart rate and metabolism ↗</a></div><div class="source-card"><h3>Calculation scope</h3><p>Eight nodes and eleven metric corridors. Time includes slopes, activities and return. Reserve equals available time minus elapsed time and the time needed to finish the route. Surfaces between corridors and alternative science views still need validation. Mars Scouts is an independent project with no NASA endorsement.</p></div>');}
function showLog(){if(state.running){pause();record('Walk paused','Viewing history.');update();}openDialog(heading('MISSION LOG','Every decision leaves a trace.','Events and confirmations from this session. Export the log to review your walk.')+(state.logs.length?state.logs.map(log=>`<article class="log-entry"><time>T+${Math.round(log.scenarioTimeS/60)} MIN · ${log.sector.toUpperCase()}</time><h3>${escapeHTML(log.title)}</h3><p>${escapeHTML(log.details)}</p></article>`).join(''):'<div class="source-card"><h3>Your mission log is ready.</h3><p>Start a walk or change conditions to record your first decision.</p></div>')+`<div class="dialog-actions"><button class="primary-button" data-action="export">${icon('download')} Download mission report</button></div>`);}
function showSettings(){
  if(state.running){pause();record('Walk paused','Reviewing mission settings.');update();}
  openDialog(heading('MISSION SETTINGS','How much time do you have?','Set the total time for travel, observations and the return to base.')+
    '<form id="settings-form"><div class="settings-grid single-setting"><label>Total mission time (min)<input name="budget" type="number" min="10" max="300" step="1" value="'+state.budget+'" required><small>Includes all travel and stops.</small></label></div><div class="dialog-actions"><button class="primary-button" type="submit">Compare updated routes</button><button type="button" class="outline-button" data-action="reset">Restart scenario</button></div></form>');
  $('#settings-form').addEventListener('submit',event=>{
    event.preventDefault();const budget=Number(new FormData(event.target).get('budget'));
    if(!Number.isFinite(budget)||budget<10||budget>300){notify('Choose a mission time between 10 and 300 min.');return;}
    pause();state.budget=budget;invalidate();record('Mission time updated',budget+' min available.');update();showRoutes();
  });
}

function showDestinations(){
  if(state.running){pause();record('Walk paused','Choosing observation stops.');update();}
  openDialog(heading('OBSERVATION STOPS','What would you like to explore?','Choose your stops. Next, compare up to three routes and pick one.')+
    '<form id="destinations-form">'+Object.entries(sectors[state.sector].stops).filter(([id])=>id!=='lookout').map(([id,data])=>
    '<label class="science-option"><input type="checkbox" name="stop" value="'+id+'" '+(state.selected.includes(id)?'checked':'')+'><div><strong>'+data.name+'</strong><p>'+data.method+' · '+data.duration+' min</p></div></label>').join('')+
    '<div class="dialog-actions"><button class="primary-button" type="submit">Compare routes '+icon('arrow')+'</button></div></form>');
  $('#destinations-form').addEventListener('submit',event=>{
    event.preventDefault();const selected=new FormData(event.target).getAll('stop');
    if(!selected.length){notify('Choose at least one observation stop.');return;}
    pause();state.selected=selected;invalidate();record('Observation stops updated',selected.map(id=>sectors[state.sector].stops[id].name).join(', '));update();showRoutes();
  });
}

function compare(){pause();capturePosition();state.progress=null;update();const before=calculate({sector:state.sector,budget:state.budget,minReserve:state.minReserve,extraLoadKg:state.extraLoadKg,selected:state.selected.filter(id=>!state.completed.includes(id)),current:state.current,elapsed:state.elapsed,anchor:state.anchor}),after=getResult();openDialog(heading('SAME POSITION · NEW CONSTRAINTS','What changed on your return.','Comparison from your current position with the same elapsed time.')+`<div class="scenario-compare"><button class="active" data-compare="before">Before the event</button><button data-compare="after">After the event</button></div><div id="comparison-result"></div><div class="dialog-actions"><button class="outline-button" data-action="dust">${state.dust?'Restore visibility':'Add poor visibility'}</button><button class="outline-button" data-action="reset">Restart scenario</button></div>`);const show=afterView=>{const r=afterView?after:before;$('#comparison-result').innerHTML=`<div class="source-card"><h3>${afterView?'After · '+sectors[state.sector].event:'Before · Normal profile'}</h3><p>Route: ${r.stops.map(id=>sectors[state.sector].stops[id].name).join(' → ')||'Direct return'} → Ares Base.<br>Total time: ${fmt(r.totalTime)} · Reserve: ${fmt(r.reserve)}.<br>Reachable nodes with return: ${r.reachable.length} of ${nodes.length}.</p><p>${afterView?(r.alternative?'The close visit no longer fits the plan. The lookout offers only a candidate visual opportunity; the objective remains pending.':state.dust?'Visibility prevents the alternative observation. A return is proposed.':'The return remains possible under the new constraints.'):'Both stops fit under normal assumptions.'}</p></div><div class="profile-row">${afterView?'SOURCE: MISSION CONTROLS':'SOURCE: SCENARIO OPERATING PROFILE'}<br>Speed: ${r.speed.toFixed(1)} m/min · Minimum reserve: ${state.minReserve} min</div>`;};show(false);$$('[data-compare]').forEach(b=>b.addEventListener('click',()=>{$$('[data-compare]').forEach(x=>x.classList.toggle('active',x===b));show(b.dataset.compare==='after');}));}
function capturePosition(){
  const p=state.progress;if(!p||!p.fraction)return;
  const from=p.path[p.index],to=p.path[p.index+1];if(!to)return;
  const anchor=state.anchor,originalFrom=from==='crew'||to==='crew'?anchor.from:from,originalTo=from==='crew'||to==='crew'?anchor.to:to;
  const a=nodeById(originalFrom),b=nodeById(originalTo),px=p.position[0]/10,py=p.position[1]/7.5;
  const fraction=((px-a.x)*(b.x-a.x)+(py-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2);
  state.elapsed+=edgeCost(from,to,result.speed,anchor)*Math.min(1,p.fraction);
  state.track.push([...p.position]);
  state.anchor={from:originalFrom,to:originalTo,fraction:Math.max(.000001,Math.min(.999999,fraction))};state.current='crew';
}
function invalidate(){state.navigationDemo=null;state.rerouteNotice=null;capturePosition();state.chosenRoute=null;state.routeChoices=[];state.revision++;state.decision=null;state.proposal=state.extraLoadKg>0||state.event||state.health.profile==='reduced'||state.health.stale||state.elapsed>0||state.dust;state.progress=null;state.approvedStops=null;state.finished=false;}
function inject(){if(state.event){compare();return;}pause();state.event=true;invalidate();record('Walking conditions adjusted',state.sector==='jezero'?'Reduced operating profile: 45 → 14 m/min. Source: mission controls.':'Ridge access closed. Source: mission controls.');update();record('New proposal calculated',`Reserve ${fmt(result.reserve)}. ${result.alternative?'Candidate lookout; science objective pending.':'Return calculated.'} Requires confirmation.`);notify('Condition updated. Review the route from your current position.');}
function pause(){clearInterval(timer);state.running=false;persistMission();}
function reset(sector=state.sector){pause();clearTimeout(riskTimer);state.traveledM=0;state.track=[[150,577.5]];state.nearHazard=false;state.speaking=false;$('#navigation-cue').hidden=true;Object.assign(state,{sector,event:false,dust:false,current:'base',elapsed:0,completed:[],finished:false,running:false,proposal:false,decision:null,selected:['wildcat','skinner'],approvedStops:null,progress:null,anchor:null,chosenRoute:null,routeChoices:[],restFeedback:null,deviation:null,rerouteNotice:null,navigationDemo:null,offRoutePosition:null,loadReview:null,avoidedHazards:[],health:{profile:'nominal',stale:false},physiology:initialPhysiology(),activeNotice:null,automaticVoice:false,zoom:1,pan:{x:0,y:0}});state.revision++;notices.reset();proximityMonitor.reset();if('speechSynthesis'in window){speechSequence++;window.speechSynthesis.cancel();}$('#risk-alert').hidden=true;applyTransform();drawTerrain();$('#main-dialog').close();$('#map-tooltip').hidden=true;update();record('Walk prepared',`Area ${sectors[sector].name}. Time budget ${state.budget} min, reserve ${state.minReserve} min.`);}
function toggleWalk(){
  if(state.navigationDemo){
    if(state.navigationDemo.phase==='awaiting-return')returnToRoute();
    else if(state.running){pause();update();}else runNavigationDemo();
    return;
  }
  unlockSound();
  if(state.running){pause();record('Walk paused','Explorer requested a pause.');update();notify('Walk paused. You can review the route.');return;}
  if(state.proposal||!result.viable||state.health.stale||state.finished||state.decision==='rejected')return;
  if(!state.chosenRoute&&!state.progress){showRoutes();return;}
  if(!state.progress){if(result.path.length<2){notify('You are already at base. Restart the scenario to explore again.');return;}state.progress={path:[...result.path],index:0,fraction:0,position:xy(state.current),revision:state.revision,cueIndex:-1};record(state.elapsed?'Walk resumed':'Walk started','Playback: 1 real second represents 15 mission seconds; slower near hazards or during guidance.');}
  else record('Walk resumed','Continuing from the paused position.');
  state.running=true;update();
  if(!state.running)return;
  const target=state.progress.path.slice(state.progress.index+1).find(id=>sectors[state.sector].stops[id]||id==='base');
  showGuidance(`Take your time. Follow the marked route toward ${sectors[state.sector].stops[target]?.name||'Ares Base'}.`);
  let previousTick=performance.now();
  timer=setInterval(()=>{
    const now=performance.now(),wallDt=now-previousTick;previousTick=now;
    const p=state.progress;
    if(!p||p.revision!==state.revision){pause();return;}
    const a=p.path[p.index],b=p.path[p.index+1];
    if(!b){finishWalk();return;}
    const duration=edgeCost(a,b,result.speed,state.anchor);
    const dtMin=Math.min(playbackMinutes(wallDt,{caution:state.nearHazard,speaking:state.speaking}),duration*(1-p.fraction)),fromNode=nodeById(a,state.anchor),toNode=nodeById(b,state.anchor);
    state.traveledM+=edgeDistance(a,b,state.anchor)*(dtMin/duration);
    state.physiology=advancePhysiology(state.physiology,{dtMin,walking:true,speedMMin:result.speed,slope:(toNode.z-fromNode.z)/edgeDistance(a,b,state.anchor),roughness:.2,extraLoadKg:state.extraLoadKg});
    renderHealth();
    p.fraction=Math.min(1,p.fraction+dtMin/duration);
    const A=xy(a),B=xy(b);
    p.position=[A[0]+(B[0]-A[0])*Math.min(1,p.fraction),A[1]+(B[1]-A[1])*Math.min(1,p.fraction)];
    persistMission(true);renderConditions();renderElevation();
    if(state.echoEnabled)renderEcho();
    const marker=$('#crew-position');
    if(marker)marker.setAttribute('transform',`translate(${p.position})`);
    $('#active-track')?.setAttribute('points',[...state.track,p.position].map(point=>point.join(',')).join(' '));
    $('#elapsed-time').textContent=`${Math.round(state.elapsed+Math.min(1,p.fraction)*duration)} min elapsed`;
    $('#stat-distance').innerHTML=`${Math.max(0,(result.distance-edgeDistance(a,b,state.anchor)*Math.min(1,p.fraction))/1000).toFixed(2)} <small>km</small>`;
    monitorProximity();
    guideRoute();
    if(!state.running){update();return;}
    if(p.fraction<1-1e-9)return;
    state.current=b;state.elapsed+=duration;state.track.push([...B]);
    record('Waypoint reached',b==='base'?'Ares Base':sectors[state.sector].stops[b]?.name||'Corridor junction');
    if((state.approvedStops??result.stops).includes(b)&&!state.completed.includes(b)){
      state.completed.push(b);state.elapsed+=sectors[state.sector].stops[b].duration;
      state.physiology=advancePhysiology(state.physiology,{dtMin:sectors[state.sector].stops[b].duration,taskLoad:.25});
      record('Stop completed',`${sectors[state.sector].stops[b].name}. Synthetic activity; real evidence pending.`);
    }
    if(b==='lookout'&&result.alternative&&!state.completed.includes('lookout')){
      state.completed.push('lookout');state.elapsed+=5;
      state.physiology=advancePhysiology(state.physiology,{dtMin:5,taskLoad:.15});
      record('Candidate observation recorded','The visual observation requires position, view and feature verification. Science objective pending.');
    }
    p.index++;p.fraction=0;p.position=B;
    if(p.index>=p.path.length-1){finishWalk();return;}
    update();
  },PLAYBACK.tickMs);
}
function finishWalk(){pause();state.finished=true;state.progress=null;state.current='base';state.anchor=null;record('Return to base completed',`Total time ${fmt(state.elapsed)}. Reserve ${fmt(state.budget-state.elapsed)}.`);$('#risk-alert').hidden=true;update();speechText=copilotMessage();notify('Walk finished. Your history is available.');}
function exportLog(){
  const sector=sectors[state.sector],p=state.progress,name=id=>id==='base'?'Ares Base':sector.stops[id]?.name||'a junction';
  const report={sector:state.sector,sectorName:sector.name,mission:sector.mission,exportedAt:new Date().toISOString(),
    status:state.finished?'Walk completed':state.running?'Walking':state.elapsed||p?'Paused':'Not started',
    elapsedMin:elapsedNow(),traveledM:state.traveledM,budgetMin:state.budget,minReserve:state.minReserve,reserveMin:result.reserve,
    position:state.offRoutePosition?'Off the mapped corridors; return along the traced path':p?.fraction>0?`Between ${name(p.path[p.index])} and ${name(p.path[p.index+1])}`:state.current==='crew'?'Between two corridor waypoints':name(state.current),
    stops:Object.entries(sector.stops).filter(([id])=>state.selected.includes(id)||state.completed.includes(id)||result.stops.includes(id)).map(([id,stop])=>({...stop,completed:state.completed.includes(id)})),
    track:p?[...state.track,p.position]:state.track,events:state.logs,
    profile:{code:activeProfile().code,name:activeProfile().name,kind:activeProfile().kind},
    routeDecisions:state.routeDecisions,team:teamReport(),extraLoadKg:state.extraLoadKg,weather:scenarioWeather(state.sector,{elapsedMin:elapsedNow(),dust:state.dust}),loadReview:state.loadReview};
  const blob=new Blob([createHistoryPdf(report)],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`mars-scouts-${activeCode}-${state.sector}-history.pdf`;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);notify('History downloaded as PDF. You can open and print it.');
}
function applyTransform(){$('#map-surface').style.transform=`translate(${state.pan.x}px,${state.pan.y}px) scale(${state.zoom})`;}
function applyWellbeing(profile){
  if(state.health.stale||state.finished)return;
  if(state.health.profile===profile&&profile==='nominal'){notify('Normal pace is already selected.');return;}
  pause();const before={elapsed:elapsedNow(),distance:state.traveledM,completed:[...state.completed]};
  state.health.profile=profile;invalidate();state.proposal=true;
  if(profile==='reduced'){
    state.elapsed+=2;
    state.physiology=advancePhysiology(state.physiology,{dtMin:2,walking:false});
  }
  record(profile==='reduced'?'2 min rest':'Normal pace requested','Operating profile: '+profile+'. Revision '+state.revision+'.');
  update();
  if(profile==='reduced'){
    const completed=before.completed.map(id=>sectors[state.sector].stops[id]?.name).filter(Boolean);
    const summary='You have traveled '+(before.distance/1000).toFixed(2)+' km in '+Math.round(before.elapsed)+' mission min and completed '+completed.length+' observation'+(completed.length===1?'':'s')+'.';
    state.restFeedback={summary,completed,distance:before.distance,elapsed:before.elapsed,remaining:result.distance,returnTime:calculate({...state,mobility:'reduced',selected:[]}).time};
    record('Rest checkpoint',summary+' Two mission minutes added. Position preserved.');persistMission();showRestFeedback();
  }else notify('Pace updated. Review the plan before continuing.');
}

const actions={
  'avoid-hazards':showSaferRoutes,
  load:showLoadReport,'simulate-deviation':simulateDeviation,'return-to-route':returnToRoute,
  'dismiss-deviation':()=>{if(state.navigationDemo)return;state.rerouteNotice=null;renderRerouteNotice();persistMission();},
  profiles:showProfiles,'select-profile':button=>switchProfile(button.dataset.code),
  routes:showRoutes,'choose-route':button=>chooseRoute(Number(button.dataset.route)),
  'rest-summary':showRestFeedback,
  'close-rest':()=>{$('#main-dialog').close();$('.copilot-card').open=true;},
  'toggle-echo':toggleEcho,
  'place-data':button=>showPlaceData(button.dataset.place),
  globe:showGlobe,planner:()=>window.scrollTo({top:0,behavior:'smooth'}),log:showLog,sources:showSources,settings:showSettings,destinations:showDestinations,
  'close-dialog':()=>$('#main-dialog').close(),'hide-tooltip':()=>$('#map-tooltip').hidden=true,
  layers:()=>{if(state.echoEnabled){state.echoEnabled=false;renderEcho(true);}$('#layer-popover').hidden=!$('#layer-popover').hidden;},
  'zoom-in':()=>{state.zoom=Math.min(2.5,state.zoom+.25);applyTransform();},'zoom-out':()=>{state.zoom=Math.max(1,state.zoom-.25);if(state.zoom===1)state.pan={x:0,y:0};applyTransform();},center:()=>{state.zoom=1;state.pan={x:0,y:0};applyTransform();},
  coverage:()=>openDialog(heading('CALCULATION COVERAGE','Range follows the corridors.','Green lines show segments between nodes with a viable return and reserve. Surfaces between them have not been evaluated.')+`<div class="source-card"><h3>About this map</h3><p>The background is an illustrative terrain generated by code. The engine evaluates only the synthetic graph of 8 nodes. The scale is approximate because the map adapts to the screen. Traversability, actual mapping and waypoint visibility have not been verified.</p></div>`),
  why:()=>openDialog(heading('HOW THE COPILOT WORKS','Your return, explained.','Estimates come from the deterministic engine and scenario assumptions.')+`<div class="source-card"><h3>Time budget − elapsed time − route − activities</h3><p>${state.budget} min budget − ${Math.round(state.elapsed)} min elapsed − ${Number.isFinite(result.time)?Math.round(result.time):'∞'} min remaining = ${fmt(result.reserve)} of reserve.</p><p>Outbound and return legs are calculated separately with different slope penalties. The required minimum reserve is ${state.minReserve} min. Current speed: ${result.speed.toFixed(1)} m/min.</p></div><div class="source-card"><h3>Why this route?</h3><p>${copilotMessage()}</p><p>Estimates use the walk parameters.</p></div><div class="dialog-actions"><button class="outline-button" data-action="settings">Adjust assumptions</button></div>`),
  'review-plan':()=>{$('.copilot-card').open=true;$('.copilot-card').scrollIntoView({behavior:'smooth',block:'center'});},
  'feel-good':()=>applyWellbeing('nominal'),rest:()=>applyWellbeing('reduced'),
  'pause-risk':()=>{pause();update();$('.map-card').scrollIntoView({behavior:'smooth',block:'center'});notify('The walk is paused. Take your time to review the map.');},
  'dismiss-risk':()=>{$('#risk-alert').hidden=true;},
  'toggle-voice':()=>{state.voiceEnabled=!state.voiceEnabled;state.speaking=false;if(state.voiceEnabled)unlockSound();if(!state.voiceEnabled&&'speechSynthesis'in window){speechSequence++;window.speechSynthesis.cancel();}state.voiceMessage=state.voiceEnabled?'Proximity alerts on. Hazard announcements play near dangerous areas.':'Voice muted. Risk alerts will still appear on screen.';syncVoice();},
  simulate:inject,compare,start:toggleWalk,reset:()=>{reset();notify('Ready to start again at your own pace.');},
  accept:()=>{if(!state.proposal||!result.viable||state.health.stale)return;state.approvedStops=[...result.stops];state.proposal=false;state.decision='accepted';record('Proposal accepted by explorer',`Revision ${state.revision}. Route ${result.path.join(' → ')}; reserve ${fmt(result.reserve)}. Visual objective ${result.sciencePending?'pending':'unchanged'}.`);update();notify('Your choice was saved. The walk remains paused; continue when you are ready.');},
  reject:()=>{if(!state.proposal)return;pause();state.proposal=false;state.decision='rejected';record('Proposal rejected by explorer',`Revision ${state.revision}. The new route is not applied. Walk paused.`);update();notify('The walk remains paused. Adjust the stops or available time.');},
  dust:()=>{pause();state.dust=!state.dust;invalidate();state.proposal=true;record('Visibility adjusted',state.dust?'Reduced visibility. Alternative observation unavailable.':'Visibility restored.');$('#main-dialog').close();update();notify('Visibility updated. Review the walk.');},
  export:exportLog,speak:()=>{if(!state.voiceEnabled){notify('Voice alerts are muted. Enable them with the copilot switch.');return;}speakMessage(speechText);}
};
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled){if(state.offRoutePosition&&['load','routes','settings','rest','feel-good','dust','simulate','destinations','accept','reject'].includes(button.dataset.action)){notify('Return to the mapped route before changing the mission plan.');return;}actions[button.dataset.action]?.(button);}const sector=e.target.closest('[data-sector]');if(sector){reset(sector.dataset.sector);showDestinations();}});
$$('[data-map-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.mapView;$$('[data-map-view]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});$('#terrain').style.filter=state.view==='contours'?'saturate(.4) brightness(.65) contrast(1.2)':'';renderMap();}));
$$('[data-layer]').forEach(input=>input.addEventListener('change',()=>{state.layers[input.dataset.layer]=input.checked;$('#layer-count').textContent=Object.values(state.layers).filter(Boolean).length;renderMap();}));
$('#echo-slider').addEventListener('input',event=>{state.echoHorizon=Math.max(0,Math.min(20,Number(event.target.value)||0));renderEcho(true);});
$('#main-dialog').addEventListener('click',e=>{if(e.target===$('#main-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
let mapDrag=null;$('#map-viewport').addEventListener('pointerdown',e=>{if(e.target.closest('button,.layer-popover,.map-node,.map-tooltip,.echo-panel')||state.zoom===1)return;mapDrag={x:e.clientX,y:e.clientY,pan:{...state.pan}};$('#map-viewport').setPointerCapture(e.pointerId);});$('#map-viewport').addEventListener('pointermove',e=>{if(!mapDrag)return;const r=$('#map-viewport').getBoundingClientRect(),maxX=r.width*(state.zoom-1)/2,maxY=r.height*(state.zoom-1)/2;state.pan={x:Math.max(-maxX,Math.min(maxX,mapDrag.pan.x+e.clientX-mapDrag.x)),y:Math.max(-maxY,Math.min(maxY,mapDrag.pan.y+e.clientY-mapDrag.y))};applyTransform();});$('#map-viewport').addEventListener('pointerup',()=>mapDrag=null);$('#map-viewport').addEventListener('pointercancel',()=>mapDrag=null);
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderMap,150);});
window.addEventListener('pagehide',()=>{pause();persistMission();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running){pause();record('Walk paused','The tab was hidden.');update();notify('The walk paused when you left the tab.');}});
initializeProfiles();
drawTerrain();update();
