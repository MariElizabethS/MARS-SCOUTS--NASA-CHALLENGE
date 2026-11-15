// Playback speed is independent of route costs and the astronaut's walking pace.
export const PLAYBACK = Object.freeze({normalMinPerSecond:.25, cautionMinPerSecond:.08, tickMs:100, instructionLeadSeconds:14});

export function playbackMinutes(realDtMs,{caution=false,speaking=false}={}){
  if(!Number.isFinite(realDtMs)||realDtMs<=0)return 0;
  // A background tab must not jump ahead when its timer resumes.
  return Math.min(realDtMs,250)/1000*(caution||speaking?PLAYBACK.cautionMinPerSecond:PLAYBACK.normalMinPerSecond);
}

export function shouldPrepareTurn(remainingMin,{caution=false}={}){
  const rate=caution?PLAYBACK.cautionMinPerSecond:PLAYBACK.normalMinPerSecond;
  return Number.isFinite(remainingMin)&&remainingMin>=0&&remainingMin/rate<=PLAYBACK.instructionLeadSeconds;
}
