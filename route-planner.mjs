import {calculate,evaluatePath,edges,anchorNode,nodeById,sectors,edgeCost} from './engine.mjs';
import {hazards} from './safety.mjs';

export const ROUTE_COLORS=['#c4a0ff','#51dccb','#ffbd73'];
const nodeNames={base:'Ares Base',junction:'Delta junction',crossing:'Upper crossing',south:'Southern corridor',ridge:'Eastern ridge',lookout:'Lookout'};
export function waypointName(id,sector='jezero'){return sectors[sector]?.stops[id]?.name||nodeNames[id]||'Current position';}

// The small scenario graph allows all simple paths for each observation leg.
function legs(start,end,{anchor,blocked,speed},otherStops){
  if(start===end)return [[start]];
  const virtual=anchorNode(anchor);
  const graph=virtual?[...edges.filter(([a,b])=>!(a===anchor.from&&b===anchor.to||a===anchor.to&&b===anchor.from)),['crew',anchor.from],['crew',anchor.to]]:edges;
  const paths=[];
  function visit(path){
    const last=path.at(-1);
    if(last===end){paths.push(path);return;}
    for(const [a,b] of graph){
      const next=a===last?b:b===last?a:null;
      if(!next||path.includes(next)||blocked.includes(next)||(next!==end&&(next==='base'||otherStops.includes(next))))continue;
      visit([...path,next]);
    }
  }
  visit([start]);
  const time=path=>path.slice(1).reduce((sum,id,i)=>sum+edgeCost(path[i],id,speed,anchor),0);
  return paths.sort((a,b)=>time(a)-time(b)).slice(0,16);
}
function distanceToSegment(zone,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((zone.x-a.x)*dx+(zone.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(a.x+t*dx-zone.x,a.y+t*dy-zone.y)*10;
}
export function routeOptions(parameters={}){
  const base=calculate({...parameters,preferredPath:null});
  if(!base.viable)return [];
  const sector=parameters.sector||'jezero',current=parameters.current||'base',anchor=parameters.anchor;
  const requested=(parameters.selected??['wildcat','skinner']).filter(id=>id!==current&&sectors[sector].stops[id]&&!(parameters.event&&id==='wildcat')&&!(parameters.dust&&id==='lookout'));
  let targets=requested;
  const options={current,anchor,speed:base.speed,blocked:base.blocked,stopData:sectors[sector].stops};
  const candidates=new Map();
  function collect(stops){
  const orders=stops.length===2?[stops,[...stops].reverse()]:[stops];
  for(const order of orders){
    let routes=[[current]],from=current;
    for(const target of [...order,'base']){
      const choices=legs(from,target,options,stops.filter(id=>id!==from&&id!==target));
      routes=routes.flatMap(route=>choices.map(leg=>[...route,...leg.slice(1)]));from=target;
    }
    for(const path of routes){
      if(parameters.firstStep&&path[1]!==parameters.firstStep)continue;
      const plan=evaluatePath(path,{...options,stops});if(!plan)continue;
      const zones=hazards.filter(zone=>path.slice(1).some((id,i)=>distanceToSegment(zone,nodeById(path[i],anchor),nodeById(id,anchor))<=zone.radiusM+zone.warningM));
      const excluded=hazards.some(zone=>zone.kind==='exclusion'&&path.slice(1).some((id,i)=>distanceToSegment(zone,nodeById(path[i],anchor),nodeById(id,anchor))<=zone.radiusM));
      const reserve=(parameters.budget??120)-(parameters.elapsed??0)-plan.time;
      if(excluded||reserve<(parameters.minReserve??20))continue;
      const corridorKey=path.slice(1).map((id,i)=>[id,path[i]].sort().join('-')).sort().join(',');
      const candidate={...plan,stops:[...order],reserve,hazards:zones.map(z=>z.name),encounters:[...new Set(path)].filter(id=>id!=='base'&&id!=='crew').map(id=>waypointName(id,sector))};
      if(!candidates.has(corridorKey)||candidate.time<candidates.get(corridorKey).time)candidates.set(corridorKey,candidate);
    }
  }
  }
  collect(targets);
  if(!candidates.size&&targets.join(',')!==base.stops.join(',')){targets=base.stops;collect(targets);}
  const all=[...candidates.values()].sort((a,b)=>a.time-b.time||a.distance-b.distance);
  if(!all.length)return [];
  const fastest=all[0],chosen=[fastest];
  const gentlest=all.filter(r=>r!==fastest).sort((a,b)=>a.ascent-b.ascent||a.hazards.length-b.hazards.length||a.time-b.time)[0];
  if(gentlest)chosen.push(gentlest);
  const third=all.filter(r=>!chosen.includes(r)).sort((a,b)=>a.hazards.length-b.hazards.length||a.time-b.time)[0];
  if(third)chosen.push(third);
  return chosen.map((route,index)=>{
    const extra=Math.max(0,route.time-fastest.time);
    const name=index===0?'Efficient traverse':route.path.includes('south')?'Southern circuit':route.path.includes('ridge')?'Eastern ridge loop':route.path.includes('lookout')?'Lookout circuit':'Alternative approach';
    const reason=index===0?`Fastest feasible route for the available observations (${Math.round(route.time)} min), including the return to base. Compared against ${all.length} feasible corridor plans.`:`${extra<.5?'Similar travel time to':`${Math.ceil(extra)} min longer than`} the recommended route; ${Math.round(route.ascent)} m of total climbing${route.ascent<fastest.ascent?`, ${Math.round(fastest.ascent-route.ascent)} m less climbing`:''}.`;
    const encounterText=`${route.encounters.join(' → ')}. ${route.hazards.length?'Proximity alerts near '+route.hazards.join(' and ')+'.':'No scenario hazard warnings along these corridors.'}`;
    return {...route,extraLoadKg:base.extraLoadKg,points:route.path.map(id=>{const n=nodeById(id,anchor);return [n.x*10,n.y*7.5];}),id:`route-${index+1}`,name,color:ROUTE_COLORS[index],recommended:index===0,reason,encounterText,scope:targets===requested?'Includes the requested observations.':base.alternative?'Requested stops do not fit; includes a candidate lookout observation.':'Requested stops do not fit; return to base only.'};
  });
}
