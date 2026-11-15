// Synthetic individual, not a clinically calibrated Mars physiology model.
// Qualitative workload factors: speed, slope, surface and suit workload.
// Reference: https://ntrs.nasa.gov/citations/20240001423
// No human EVA measurements from the surface of Mars are used.
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function initialPhysiology(){return {heartRate:74,respiratoryRate:14,spo2:98.1,effort:0,fatigue:0,timeMin:0,history:[74]};}

export function advancePhysiology(previous,{dtMin=0,walking=false,speedMMin=0,slope=0,roughness=.2,taskLoad=0,extraLoadKg=0}={}){
  if(!Number.isFinite(dtMin)||dtMin<=0)return {...previous,history:[...previous.history]};
  const dt=clamp(dtMin,0,30),timeMin=previous.timeMin+dt;
  const speed=Number.isFinite(speedMMin)?clamp(speedMMin,0,80):0;
  const grade=Number.isFinite(slope)?clamp(slope,-.5,.5):0;
  const surface=Number.isFinite(roughness)?clamp(roughness,0,1):.2;
  // Coefficients are application assumptions; Mars gravity is not applied as
  // a linear reduction in heart rate or metabolic demand.
  const load=Number.isFinite(extraLoadKg)?clamp(extraLoadKg,0,80):0;
  const effort=walking?clamp(.20+speed/45*.35+Math.max(0,grade)*2.5+surface*.18+load*.006,.15,1):clamp(Number.isFinite(taskLoad)?taskLoad:0,0,1);
  const fatigue=clamp(previous.fatigue+dt*(effort>0?effort*.6:-1.2),0,100);
  const hrTarget=74+effort*66+fatigue*.10;
  const rrTarget=14+effort*16;
  const blend=1-Math.exp(-dt/(walking?.8:1.2));
  const heartRate=clamp(previous.heartRate+(hrTarget-previous.heartRate)*blend,65,155);
  const respiratoryRate=clamp(previous.respiratoryRate+(rrTarget-previous.respiratoryRate)*blend,12,32);
  // An oxygenated suit circuit is assumed. Ambient Martian air is not breathed;
  // displayed blood saturation is distinct from suit oxygen supply or pressure.
  const saturationTarget=98.1-effort*.18+Math.sin(timeMin*.31)*.10;
  const spo2=clamp(previous.spo2+(saturationTarget-previous.spo2)*blend,97.5,98.5);
  return {heartRate,respiratoryRate,spo2,effort:effort*100,fatigue,timeMin,history:[...previous.history,heartRate].slice(-40)};
}
