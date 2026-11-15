export const PROFILE_COLORS=['#d3b5ff','#52e0be','#ffba78','#77baff','#f79bc5','#e0dc80'];
export const PROFILE_KEY='mars-scouts-profiles-v1';
export function createProfile({code,name,kind='astronaut'},existing=[]){
  code=String(code??'').trim().toUpperCase();name=String(name??'').trim();
  if(!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code))throw new Error('Use a unique code of 2–16 letters, numbers or hyphens.');
  if(existing.some(p=>p.code===code))throw new Error('This code already exists. Select that profile to continue.');
  if(!name||name.length>40)throw new Error('Enter a name with 1–40 characters.');
  if(kind!=='astronaut')throw new Error('Only astronaut profiles are supported.');
  return {code,name,kind,color:PROFILE_COLORS[existing.length%PROFILE_COLORS.length],mission:null};
}
export function loadProfiles(storage){
  try{
    const saved=JSON.parse(storage?.getItem(PROFILE_KEY)||'null');
    if(saved?.version!==1||!Array.isArray(saved.profiles)||!saved.profiles.length)return null;
    const profiles=[];
    for(const entry of saved.profiles.slice(0,12)){
      if(entry.kind==='rover')continue; // Retired profile type: preserve astronaut missions only.
      const profile=createProfile(entry,profiles);
      if(entry.mission&&typeof entry.mission==='object')profile.mission=entry.mission;
      profiles.push(profile);
    }
    if(!profiles.length)return null;
    return {profiles,activeCode:profiles.some(p=>p.code===saved.activeCode)?saved.activeCode:profiles[0].code};
  }catch{return null;}
}
export function saveProfiles(storage,profiles,activeCode){
  try{
    if(!storage)return false;
    storage.setItem(PROFILE_KEY,JSON.stringify({version:1,activeCode,profiles:profiles.map(profile=>({...profile,mission:profile.mission?{...profile.mission,running:false,speaking:false,automaticVoice:false}:null}))}));
    return true;
  }catch{return false;}
}
