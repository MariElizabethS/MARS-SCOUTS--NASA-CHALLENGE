// All coordinates, elevations and operational parameters are synthetic demo data.
import {carriedLoad} from './conditions.mjs';
import {hazardsFor,segmentIntersectsHazard} from './safety.mjs';
export const sectors = {
  jezero: { name:'Jezero Crater', title:'Hawksbill Gap', mission:'The delta contact', coordinates:'18.44° N · 77.45° E', region:'JEZERO · WESTERN DELTA', event:'Reduced mobility', primary:'wildcat', secondary:'skinner', alternative:'lookout', stops:{ wildcat:{ name:'Wildcat Ridge', method:'Texture and layering', question:'Relate fine material to the delta contact.', duration:10 }, skinner:{ name:'Skinner Ridge', method:'Outcrop sampling', question:'Document the layering of the second outcrop up close.', duration:12 }, lookout:{ name:'Delta lookout', method:'Candidate visual observation', question:'Visually relate the contact. View needs validation; this does not complete the science objective.', duration:5 } } },
  gale: { name:'Gale Crater', title:'Moon Valley', mission:'Between ridges and hollows', coordinates:'4.75° S · 137.40° E', region:'GALE · MOUNT SHARP', event:'Ridge access closed', primary:'wildcat', secondary:'skinner', alternative:'lookout', stops:{ wildcat:{ name:'Valley hollow', method:'Terrain and texture', question:'Document the texture of a boxwork hollow.', duration:10 }, skinner:{ name:'Monte Grande ridge', method:'Surface comparison', question:'Compare texture and terrain with the hollow.', duration:12 }, lookout:{ name:'Boxwork lookout', method:'Candidate visual observation', question:'Compare ridge and hollow from a distance. Position and view need validation.', duration:5 } } }
};
export const nodes = [
  {id:'base',x:15,y:77,z:0}, {id:'junction',x:31,y:59,z:12},
  {id:'wildcat',x:45,y:40,z:31}, {id:'crossing',x:64,y:47,z:40},
  {id:'skinner',x:79,y:23,z:74}, {id:'lookout',x:58,y:66,z:29},
  {id:'south',x:36,y:84,z:7}, {id:'ridge',x:85,y:68,z:57}
];
export const edges = [['base','junction'],['junction','wildcat'],['wildcat','crossing'],['crossing','skinner'],['wildcat','lookout'],['lookout','junction'],['lookout','south'],['south','base'],['lookout','crossing'],['crossing','ridge'],['ridge','lookout']];
export function anchorNode(anchor){
  if(!anchor||!Number.isFinite(anchor.fraction)||anchor.fraction<=0||anchor.fraction>=1||!edges.some(([a,b])=>a===anchor.from&&b===anchor.to||a===anchor.to&&b===anchor.from))return null;
  const a=nodes.find(n=>n.id===anchor.from),b=nodes.find(n=>n.id===anchor.to);
  return {id:'crew',x:a.x+(b.x-a.x)*anchor.fraction,y:a.y+(b.y-a.y)*anchor.fraction,z:a.z+(b.z-a.z)*anchor.fraction};
}
export const nodeById = (id,anchor) => id==='crew'?anchorNode(anchor):nodes.find(n => n.id === id);
export function edgeDistance(a,b,anchor){const p=nodeById(a,anchor),q=nodeById(b,anchor);return Math.hypot(p.x-q.x,p.y-q.y)*10;}
export function edgeCost(a,b,speed=45,anchor){const p=nodeById(a,anchor),q=nodeById(b,anchor),d=edgeDistance(a,b,anchor);if(!d)return 0;const slope=(q.z-p.z)/d;return d/speed*(1+Math.max(slope,0)*6+Math.abs(slope)*1.2);}
export function shortestPath(start,end,{speed=45,blocked=[],anchor=null,avoidZones=[]}={}){
  if (!nodeById(start,anchor)||!nodeById(end,anchor)||!Number.isFinite(speed)||speed<=0) return {path:[],time:Infinity,distance:Infinity};
  const virtual=anchorNode(anchor),graphNodes=virtual?[...nodes,virtual]:nodes;
  const graphEdges=virtual?[...edges.filter(([a,b])=>!(a===anchor.from&&b===anchor.to||a===anchor.to&&b===anchor.from)),['crew',anchor.from],['crew',anchor.to]]:edges;
  const distances=new Map(graphNodes.map(n=>[n.id,Infinity])),previous=new Map(),unvisited=new Set(graphNodes.map(n=>n.id));distances.set(start,0);
  while(unvisited.size){const current=[...unvisited].sort((a,b)=>distances.get(a)-distances.get(b))[0];if(distances.get(current)===Infinity)break;unvisited.delete(current);if(current===end)break;
    for(const [a,b] of graphEdges){const next=a===current?b:b===current?a:null;if(!next||!unvisited.has(next)||blocked.includes(next)||blocked.includes(current)||avoidZones.some(zone=>segmentIntersectsHazard(nodeById(current,anchor),nodeById(next,anchor),zone)))continue;const cost=distances.get(current)+edgeCost(current,next,speed,anchor);if(cost<distances.get(next)){distances.set(next,cost);previous.set(next,current);}}
  }
  if(distances.get(end)===Infinity)return {path:[],time:Infinity,distance:Infinity};
  const path=[end];while(path[0]!==start)path.unshift(previous.get(path[0]));
  return {path,time:distances.get(end),distance:path.slice(1).reduce((sum,n,i)=>sum+edgeDistance(path[i],n,anchor),0)};
}
export function itinerary(current,stops,options={}){
  const path=[current];let time=0,distance=0,from=current;
  for(const stop of [...stops,'base']){const part=shortestPath(from,stop,options);if(!part.path.length)return {path:[],time:Infinity,distance:Infinity};path.push(...part.path.slice(1));time+=part.time+(options.stopData?.[stop]?.duration||0);distance+=part.distance;from=stop;}
  return {path,time,distance};
}
export function evaluatePath(path,{current='base',speed=45,blocked=[],anchor=null,stops=[],stopData={},avoidZones=[]}={}){
  const virtual=anchorNode(anchor);
  const graph=virtual?[...edges.filter(([a,b])=>!(a===anchor.from&&b===anchor.to||a===anchor.to&&b===anchor.from)),['crew',anchor.from],['crew',anchor.to]]:edges;
  if(!Array.isArray(path)||path[0]!==current||path.at(-1)!=='base'||path.some(id=>!nodeById(id,anchor)||blocked.includes(id))||stops.some(id=>!path.includes(id)))return null;
  let time=0,distance=0,ascent=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    if(!graph.some(([x,y])=>x===a&&y===b||x===b&&y===a))return null;
    if(avoidZones.some(zone=>segmentIntersectsHazard(nodeById(a,anchor),nodeById(b,anchor),zone)))return null;
    time+=edgeCost(a,b,speed,anchor);distance+=edgeDistance(a,b,anchor);
    ascent+=Math.max(0,nodeById(b,anchor).z-nodeById(a,anchor).z);
  }
  time+=[...new Set(stops)].reduce((sum,id)=>sum+(stopData[id]?.duration||0),0);
  return {path:[...path],time,distance,ascent};
}
export function calculate({sector='jezero',event=false,budget=120,minReserve=20,selected=['wildcat','skinner'],elapsed=0,current='base',dust=false,mobility='nominal',anchor=null,preferredPath=null,extraLoadKg=0,avoidedHazards=[]}={}){
  const data=sectors[sector];if(!data)throw new Error('Sector desconocido');
  const reduced=mobility==='reduced'||(event&&sector==='jezero');
  const load=carriedLoad(extraLoadKg),unloadedSpeed=reduced?14:45,speed=unloadedSpeed*load.paceFactor;
  const blocked=event&&sector==='gale'?['skinner']:[];
  const avoidZones=hazardsFor({sector,event}).filter(zone=>avoidedHazards.includes(zone.id));
  const options={speed,blocked,stopData:data.stops,anchor,avoidZones};
  const remaining=selected.filter(id=>id!==current&&data.stops[id]&&!(event&&id==='wildcat')&&!(dust&&id==='lookout'));
  const nominal=evaluatePath(preferredPath,{...options,current,stops:remaining})??itinerary(current,remaining,options);
  let best=nominal,stops=remaining,alternative=remaining.includes('lookout');
  const reserveFor=plan=>budget-elapsed-plan.time;
  const nominalViable=reserveFor(nominal)>=minReserve;
  const unloaded=evaluatePath(nominal.path,{...options,current,stops:remaining,speed:unloadedSpeed});
  const loadPenaltyMin=unloaded&&Number.isFinite(nominal.time)?Math.max(0,nominal.time-unloaded.time):0;
  if(!nominalViable){
    const candidate=itinerary(current,dust?[]:['lookout'],options);
    if(!dust&&remaining.length&&reserveFor(candidate)>=minReserve){best=candidate;stops=['lookout'];alternative=true;}
    else {best=itinerary(current,[],options);stops=[];alternative=false;}
  }
  const reachable=nodes.filter(n=>{
    const outbound=shortestPath(current,n.id,options),home=shortestPath(n.id,'base',options);
    return budget-elapsed-outbound.time-home.time>=minReserve;
  }).map(n=>n.id);
  const reachableEdges=edges.filter(([a,b])=>{
    const traversal=(from,to)=>shortestPath(current,from,options).time+edgeCost(from,to,speed,anchor)+shortestPath(to,'base',options).time;
    return !blocked.includes(a)&&!blocked.includes(b)&&!avoidZones.some(zone=>segmentIntersectsHazard(nodeById(a),nodeById(b),zone))&&budget-elapsed-Math.min(traversal(a,b),traversal(b,a))>=minReserve;
  });
  const loadRisk=load.kg>0?(!nominalViable?'critical':reserveFor(nominal)<minReserve+15||load.paceFactor<.65?'caution':'normal'):'normal';
  return {...best,stops,speed,elapsed,current,blocked,avoidZones,reachable,reachableEdges,alternative,nominalViable,nominal,nominalReserve:reserveFor(nominal),reserve:reserveFor(best),viable:reserveFor(best)>=minReserve,totalTime:elapsed+best.time,sciencePending:alternative||dust,extraLoadKg:load.kg,unloadedSpeed,loadPenaltyMin,loadRisk};
}
