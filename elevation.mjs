import {nodeById,edgeDistance} from './engine.mjs';

export function elevationProfile({path=[],anchor,segmentIndex=0,fraction=0}={}){
  const points=[];let distance=0;
  for(let i=0;i<path.length;i++){
    const node=nodeById(path[i],anchor);if(!node)return null;
    if(i)distance+=edgeDistance(path[i-1],path[i],anchor);
    points.push({distance,z:node.z});
  }
  if(!points.length)return null;
  const index=Math.max(0,Math.min(points.length-1,Math.floor(segmentIndex)||0)),a=points[index],b=points[index+1]??a;
  const t=Number.isFinite(fraction)?Math.max(0,Math.min(1,fraction)):0;
  const currentDistance=a.distance+(b.distance-a.distance)*t;
  return {points,distance,currentDistance,remaining:Math.max(0,distance-currentDistance),height:a.z+(b.z-a.z)*t,peak:Math.max(...points.map(p=>p.z))};
}
