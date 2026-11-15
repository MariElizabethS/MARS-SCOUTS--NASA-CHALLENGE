// Scenario rules, not medical thresholds. Positions use the synthetic 1 km square.
export const hazards = [
  {id:'loose-ground',name:'Loose ground',description:'Unstable ground and loose rocks can cause a loss of footing. Entry is prohibited in this scenario.',x:17,y:23,radiusM:110,warningM:180,kind:'exclusion'},
  {id:'steep-slope',name:'Steep slope',description:'A steep incline with loose surface material makes footing unstable and increases the risk of slipping.',x:70,y:37,radiusM:75,warningM:180,kind:'caution'}
];

export function hazardsFor({sector='jezero',event=false}={}){
  return event&&sector==='gale'?[...hazards,{id:'closed-ridge',name:'Closed ridge access',description:'The passage along this ridge is closed. Do not enter; use another mapped corridor.',x:79,y:23,radiusM:45,warningM:180,kind:'exclusion'}]:hazards;
}

// Nodes and positions share the scenario's metric scale: one unit is 10 m.
export function hazardDistanceToSegment(a,b,zone){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((zone.x-a.x)*dx+(zone.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(a.x+t*dx-zone.x,a.y+t*dy-zone.y)*10;
}
export function segmentIntersectsHazard(a,b,zone){return hazardDistanceToSegment(a,b,zone)<=zone.radiusM;}

export function proximityAlerts(position,zones=hazards){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.y))return [];
  return zones.map(zone=>{
    const distanceM=Math.hypot(position.x-zone.x,position.y-zone.y)*10-zone.radiusM;
    return {...zone,distanceM:Math.max(0,Math.round(distanceM)),phase:distanceM<=0?'inside':'near',critical:distanceM<=0&&zone.kind==='exclusion',withinWarning:distanceM<=zone.warningM};
  }).filter(zone=>zone.withinWarning).sort((a,b)=>Number(b.critical)-Number(a.critical)||a.distanceM-b.distanceM);
}

export class NoticeGate {
  #seen=new Set();
  take(key){if(this.#seen.has(key))return false;this.#seen.add(key);return true;}
  reset(){this.#seen.clear();}
}

export class ProximityMonitor {
  #phases=new Map();
  #sequence=0;
  update(position,zones=hazards){
    const active=proximityAlerts(position,zones);
    const events=active.filter(zone=>this.#phases.get(zone.id)!==zone.phase).map(zone=>({...zone,key:`proximity-${zone.id}-${zone.phase}-${++this.#sequence}`}));
    this.#phases=new Map(active.map(zone=>[zone.id,zone.phase]));
    return {active,events};
  }
  reset(){this.#phases.clear();}
}

export function operationalMobility({profile='nominal',stale=false}={}){
  // Loss of telemetry uses the scenario's conservative profile until refreshed.
  // Pulse and SpO2 never enter this decision.
  return stale||profile==='reduced'?'reduced':'nominal';
}
