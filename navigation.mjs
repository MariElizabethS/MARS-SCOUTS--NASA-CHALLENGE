import {nodeById,edges,edgeCost,edgeDistance,sectors} from './engine.mjs';
import {proximityAlerts,segmentIntersectsHazard} from './safety.mjs';
import {routeOptions} from './route-planner.mjs';

export function navigationSegment(from,to,{anchor=null,speed=45,endFraction=1,phase='approach'}={}){
  const hasCrew=from==='crew'||to==='crew';
  const edgeFrom=hasCrew?anchor.from:from,edgeTo=hasCrew?anchor.to:to;
  const start=from==='crew'?anchor.fraction:from===edgeFrom?0:1;
  const end=to==='crew'?anchor.fraction:hasCrew?(to===edgeTo?1:0):endFraction;
  const distanceM=edgeDistance(edgeFrom,edgeTo)*Math.abs(end-start);
  const timeMin=edgeCost(start<end?edgeFrom:edgeTo,start<end?edgeTo:edgeFrom,speed)*Math.abs(end-start);
  return {from:edgeFrom,to:edgeTo,start,end,distanceM,timeMin,phase};
}
export function segmentPosition(segment,fraction){
  if(segment.offCorridor){
    const t=Math.max(0,Math.min(1,fraction)),a=segment.startPoint,b=segment.endPoint;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z,unmapped:t<1-1e-9||segment.phase!=='returning'};
  }
  const t=segment.start+(segment.end-segment.start)*Math.max(0,Math.min(1,fraction)),a=nodeById(segment.from),b=nodeById(segment.to);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,current:t<=1e-9?segment.from:t>=1-1e-9?segment.to:'crew',anchor:t>1e-9&&t<1-1e-9?{from:segment.from,to:segment.to,fraction:t}:null};
}

// Prefer a mapped side corridor. Leaving unmapped ground is a separate demo state
// that permits retracing only; it is never offered as a new navigable corridor.
export function missedTurn({path,current='base',anchor=null,speed=45,blocked=[],selected=[],completed=[],sector='jezero',avoidZones=[]}={}){
  if(!Array.isArray(path)||path.length<2||path[0]!==current||!Number.isFinite(speed)||speed<=0)return null;
  for(let i=0;i<path.length-1;i++){
    const from=path[i];if(from==='crew')continue;
    const previous=path[i-1],next=path[i+1];
    const originalPrevious=previous==='crew'?(anchor.from===from?anchor.to:anchor.from):previous;
    const neighbors=edges.flatMap(([a,b])=>a===from?[b]:b===from?[a]:[]).filter(id=>id!==next&&id!==originalPrevious&&!blocked.includes(id)&&!blocked.includes(from));
    // Favor a side corridor absent from the remaining selected route.
    neighbors.sort((a,b)=>Number(path.includes(a))-Number(path.includes(b)));
    for(const to of neighbors){
      if(avoidZones.some(zone=>segmentIntersectsHazard(nodeById(from),nodeById(to),zone)))continue;
      const a=nodeById(from),b=nodeById(to),fraction=Math.min(.3,50/edgeDistance(from,to));
      const point={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
      if(proximityAlerts(point).some(zone=>zone.critical))continue;
      const approach=path.slice(0,i+1),visitedStops=[...new Set(approach.slice(1))].filter(id=>selected.includes(id)&&!completed.includes(id));
      const travelMin=approach.slice(1).reduce((sum,id,index)=>sum+edgeCost(approach[index],id,speed,anchor),0)+edgeCost(from,to,speed)*fraction;
      const distanceM=approach.slice(1).reduce((sum,id,index)=>sum+edgeDistance(approach[index],id,anchor),0)+edgeDistance(from,to)*fraction;
      const activityMin=visitedStops.reduce((sum,id)=>sum+(sectors[sector].stops[id]?.duration||0),0);
      const track=approach.map(id=>{const n=nodeById(id,anchor);return [n.x*10,n.y*7.5];});
      track.push([point.x*10,point.y*7.5]);
      const segments=approach.slice(1).map((id,index)=>navigationSegment(approach[index],id,{anchor,speed}));
      segments.push(navigationSegment(from,to,{speed,endFraction:fraction,phase:'departing'}));
      return {current:'crew',anchor:{from,to,fraction},track,segments,branchIndex:i,travelMin,activityMin,distanceM,visitedStops,wrongTurn:[track.at(-2),track.at(-1)]};
    }
  }
  // A final corridor may have no junction ahead. Demonstrate leaving its mapped
  // line directly, then require retracing that track instead of inventing a road.
  const a=nodeById(current,anchor),b=nodeById(path[1],anchor),length=Math.hypot(b.x-a.x,b.y-a.y)||1;
  for(const sign of [1,-1]){
    const end={x:a.x-(b.y-a.y)/length*5*sign,y:a.y+(b.x-a.x)/length*5*sign,z:a.z};
    if(end.x<0||end.x>100||end.y<0||end.y>100||proximityAlerts(end).some(zone=>zone.critical))continue;
    if(avoidZones.some(zone=>segmentIntersectsHazard(a,end,zone)))continue;
    const segment={offCorridor:true,startPoint:{x:a.x,y:a.y,z:a.z},endPoint:end,distanceM:50,timeMin:50/speed,phase:'departing'};
    const track=[[a.x*10,a.y*7.5],[end.x*10,end.y*7.5]];
    return {offCorridor:true,current,anchor,track,segments:[segment],branchIndex:0,travelMin:segment.timeMin,activityMin:0,distanceM:50,visitedStops:[],wrongTurn:track};
  }
  return null;
}

// A genuine alternative continues down the side corridor and retains all remaining
// observations. A U-turn, a shorter fallback itinerary or a closed path is not one.
export function deviationRecovery(parameters,wrongTurn){
  if(wrongTurn.offCorridor){
    const segment=wrongTurn.segment;
    return {kind:'return',returnTo:parameters.current,segment:{...segment,startPoint:segment.endPoint,endPoint:segment.startPoint,phase:'returning'}};
  }
  const selected=(parameters.selected??[]).filter(id=>!(parameters.completed??[]).includes(id));
  const options=routeOptions({...parameters,selected,current:'crew',anchor:wrongTurn.anchor,firstStep:wrongTurn.anchor.to})
    .filter(route=>selected.every(id=>route.stops.includes(id)));
  if(options.length)return {kind:'alternative',options};
  const {from,to,fraction}=wrongTurn.anchor;
  const reverse=navigationSegment(from,to,{speed:parameters.speed??45,endFraction:fraction,phase:'returning'});
  reverse.start=fraction;reverse.end=0;
  reverse.timeMin=edgeCost(to,from,parameters.speed??45)*fraction;
  return {kind:'return',returnTo:from,segment:reverse};
}
