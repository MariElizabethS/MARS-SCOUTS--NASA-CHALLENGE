// Scenario assumptions, not calibrated EVA load limits or live weather telemetry.
export function carriedLoad(extraLoadKg=0){
  const kg=Number.isFinite(extraLoadKg)?Math.max(0,Math.min(80,extraLoadKg)):0;
  return {kg,paceFactor:1/(1+.02*kg)};
}
export function scenarioWeather(sector='jezero',{elapsedMin=0,dust=false}={}){
  const data=sector==='gale'?{name:'Gale Crater',mid:-43.3,amplitude:30,wind:6.6}:{name:'Jezero Crater',mid:-44.7,amplitude:35,wind:5.4};
  const elapsed=Number.isFinite(elapsedMin)?Math.max(0,elapsedMin):0;
  const localHour=(9+elapsed/60)%24;
  const temperatureC=Math.round(data.mid+data.amplitude*Math.cos((localHour-13)*Math.PI/12)-(dust?4:0));
  return {sector,area:data.name,temperatureC,lowC:data.mid-data.amplitude,highC:data.mid+data.amplitude,windMps:Math.round((data.wind+(dust?6:0)+Math.sin(elapsed/18)*.8)*10)/10,visibility:dust?'Poor visibility · airborne dust':'Good visibility',condition:dust?'Dusty':'Clear',localTime:String(Math.floor(localHour)).padStart(2,'0')+':'+String(Math.floor(localHour%1*60)).padStart(2,'0'),source:'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/',simulated:true};
}
