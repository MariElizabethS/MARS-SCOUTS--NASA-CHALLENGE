import {calculate,nodeById,edgeCost,sectors} from './engine.mjs';

// Project along evaluated corridors without modifying the live mission.
function positionOnEdge(from,to,fraction,anchor){
  const a=nodeById(from,anchor),b=nodeById(to,anchor);
  if(fraction<=0)return {current:from,anchor};
  if(fraction>=1)return {current:to,anchor};
  const x=a.x+(b.x-a.x)*fraction,y=a.y+(b.y-a.y)*fraction;
  const originalFrom=from==='crew'||to==='crew'?anchor.from:from;
  const originalTo=from==='crew'||to==='crew'?anchor.to:to;
  const A=nodeById(originalFrom),B=nodeById(originalTo);
  const t=((x-A.x)*(B.x-A.x)+(y-A.y)*(B.y-A.y))/((B.x-A.x)**2+(B.y-A.y)**2);
  return {current:'crew',anchor:{from:originalFrom,to:originalTo,fraction:Math.max(.000001,Math.min(.999999,t))}};
}

export function returnEcho(options,horizonMin=5){
  const {progress,completed=[],...parameters}=options;
  const plan=calculate(parameters),speed=plan.speed;
  let start={current:parameters.current??'base',anchor:parameters.anchor,elapsed:parameters.elapsed??0};
  let path=plan.path;
  if(progress?.path?.[progress.index+1]){
    const from=progress.path[progress.index],to=progress.path[progress.index+1],fraction=Math.max(0,Math.min(1,progress.fraction||0));
    start={...start,...positionOnEdge(from,to,fraction,parameters.anchor),elapsed:start.elapsed+edgeCost(from,to,speed,parameters.anchor)*fraction};
    path=[start.current,...progress.path.slice(progress.index+1)];
    if(start.current===to)path=path.slice(1);
  }
  const now=calculate({...parameters,...start,selected:[],preferredPath:null});
  let future={...start},remaining=Number.isFinite(horizonMin)?Math.max(0,Math.min(20,horizonMin)):0,advanced=0,activity=false;
  const done=new Set(completed),stops=new Set(plan.stops);
  for(let i=1;i<path.length&&remaining>1e-9;i++){
    const from=path[i-1],to=path[i],cost=edgeCost(from,to,speed,future.anchor);
    if(!Number.isFinite(cost)||cost<0)break;
    if(remaining<cost){
      future={...future,...positionOnEdge(from,to,remaining/cost,future.anchor),elapsed:future.elapsed+remaining};advanced+=remaining;remaining=0;break;
    }
    future.current=to;future.elapsed+=cost;remaining-=cost;advanced+=cost;
    if(stops.has(to)&&!done.has(to)){
      const duration=sectors[parameters.sector??'jezero'].stops[to]?.duration??0,spent=Math.min(duration,remaining);
      future.elapsed+=spent;remaining-=spent;advanced+=spent;done.add(to);activity=spent<duration;
    }
  }
  const later=calculate({...parameters,...future,selected:[],preferredPath:null});
  const point=nodeById(future.current,future.anchor),startPoint=nodeById(start.current,start.anchor);
  return {now,later,advancedMin:advanced,activity,position:{x:point.x,y:point.y,z:point.z},start:{x:startPoint.x,y:startPoint.y},anchor:future.anchor,current:future.current,reserveChange:now.reserve-later.reserve};
}
