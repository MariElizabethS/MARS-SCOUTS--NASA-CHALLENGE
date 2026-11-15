// Small, offline PDF writer. WinAnsi also preserves accented place names.
const PAGE_W=595.28, PAGE_H=841.89, MARGIN=44, BOTTOM=62;
const special=new Map([['€',128],['‘',145],['’',146],['“',147],['”',148],['•',149],['–',150],['—',151]]);
function latin(value){return [...String(value??'').normalize('NFC').replaceAll('→',' > ').replaceAll('↗','').replaceAll('₂','2')].map(c=>{const n=c.charCodeAt(0);return n<=255?c:String.fromCharCode(special.get(c)??63);}).join('');}
function literal(value){return latin(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)').replace(/[\r\n\t]/g,' ');}
function bytes(value){return Uint8Array.from(value,c=>c.charCodeAt(0)&255);}
// Conservative Helvetica widths keep wrapped paragraphs inside their columns.
function width(value,size){return [...latin(value)].reduce((sum,c)=>{const base=c.normalize('NFD')[0];return sum+(/[W@%]/.test(base)||c.charCodeAt(0)===151?1.05:/[Mmw]/.test(base)?.90:/[ilI.,:;'!| ]/.test(base)?.35:/[A-Z]/.test(base)?.85:/[0-9]/.test(base)?.60:.67);},0)*size;}
function wrap(value,maxWidth,size){
  const lines=[];let line='';
  for(const word of latin(value).split(/\s+/).filter(Boolean)){
    if(line&&width(line+' '+word,size)>maxWidth){lines.push(line);line='';}
    if(width(word,size)>maxWidth){for(const c of word){if(width(line+c,size)>maxWidth){lines.push(line);line='';}line+=c;}}
    else line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
const number=(n,digits=0)=>Number.isFinite(n)?n.toFixed(digits):'No access';
const dateText=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Date unavailable':new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Guayaquil'}).format(date);};

export function createHistoryPdf(report){
  const pages=[];let page=[],y=0;
  const accent=report.sector==='jezero'?[.53,.38,.72]:[.55,.36,.22];
  const rgb=hex=>/^#[0-9a-f]{6}$/i.test(hex||'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255):accent;
  const color=c=>c.map(v=>v.toFixed(3)).join(' ');
  const text=(value,x,top,size=10,bold=false,ink=[.16,.20,.24])=>page.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color(ink)} rg 1 0 0 1 ${x.toFixed(2)} ${(PAGE_H-top).toFixed(2)} Tm (${literal(value)}) Tj ET`);
  const line=(x1,top1,x2,top2,ink=[.83,.86,.88],weight=.6)=>page.push(`${color(ink)} RG ${weight} w ${x1} ${PAGE_H-top1} m ${x2} ${PAGE_H-top2} l S`);
  function newPage(){
    if(page.length)pages.push(page);
    page=[];y=112;
    page.push(`${color(accent)} rg 0 ${PAGE_H-8} ${PAGE_W} 8 re f`);
    text('MARS SCOUTS',MARGIN,42,17,true,accent);
    text('MISSION REPORT',MARGIN,64,9,true);
    text('EVA-01  /  '+report.sectorName,MARGIN,82,9);
    line(MARGIN,94,PAGE_W-MARGIN,94);
  }
  function ensure(height){if(y+height>PAGE_H-BOTTOM)newPage();}
  function paragraph(value,{size=10,bold=false,indent=0,ink}={}){
    for(const row of wrap(value,PAGE_W-MARGIN*2-indent,size)){ensure(size*1.55);text(row,MARGIN+indent,y,size,bold,ink);y+=size*1.55;}
  }
  function section(title){ensure(48);y+=12;text(title.toUpperCase(),MARGIN,y,10,true,accent);y+=19;}
  function diagram(paths,caption){
    ensure(145);
    const top=y+5,height=100,w=PAGE_W-2*MARGIN;
    page.push(`0.96 0.97 0.98 rg ${MARGIN} ${PAGE_H-top-height} ${w} ${height} re f`);
    for(const route of paths){
      if(!route.points?.length)continue;
      const points=route.points.map(([x,py])=>[MARGIN+12+x/1000*(w-24),PAGE_H-(top+8+py/750*(height-16))]);
      page.push(`${color(rgb(route.color))} RG 2 w ${points.map(([x,py],i)=>`${x.toFixed(2)} ${py.toFixed(2)} ${i?'l':'m'}`).join(' ')} S`);
      const [x,py]=points.at(-1);page.push(`${color(rgb(route.color))} rg ${(x-2).toFixed(2)} ${(py-2).toFixed(2)} 4 4 re f`);
    }
    y=top+height+16;paragraph(caption,{size:8});
  }
  function decisions(items){
    for(const decision of items??[]){
      ensure(220);
      section('Route comparison - '+String(decision.sector).toUpperCase());
      paragraph('Decision recorded: '+dateText(decision.time),{size:9});
      if(decision.trigger)paragraph('Trigger: '+decision.trigger,{size:9});
      const chosen=decision.options.find(option=>option.id===decision.chosenId);
      paragraph('Chosen: '+(chosen?.name||'Route')+' | '+(chosen?.recommended?'Recommended option':'Explorer chose an alternative'),{bold:true});
      for(const option of decision.options){
        ensure(125);
        y+=8;paragraph(option.id+' - '+option.name+(option.recommended?' [Recommended]':'')+(option.id===decision.chosenId?' [Selected]':''),{bold:true,size:10,ink:rgb(option.color).map(value=>value*.6)});
        paragraph(number(option.time)+' min | '+number(option.distance/1000,2)+' km | '+number(option.ascent)+' m climb | '+number(option.extraLoadKg??0,1)+' kg extra',{size:9});
        paragraph(option.reason,{size:9});paragraph('Along the way: '+option.encounterText,{size:9});paragraph(option.scope,{size:8});
      }
      diagram(decision.options,'Compared corridors. Route colors match the app; the explorer selected '+(chosen?.name||'a route')+'.');
    }
  }
  newPage();
  paragraph(report.mission,{size:19,bold:true});y+=6;
  paragraph('Exported: '+dateText(report.exportedAt)+' (Ecuador)',{size:9});
  if(report.profile)paragraph('Active profile: '+report.profile.name+' | '+report.profile.code+' | '+report.profile.kind,{size:10,bold:true});
  section('Walk summary');
  paragraph('Status: '+report.status,{bold:true});
  paragraph('Elapsed time: '+number(report.elapsedMin,1)+' min');
  paragraph('Distance traveled: '+number(report.traveledM/1000,2)+' km');
  paragraph('Available time: '+number(report.budgetMin)+' min | Minimum margin: '+number(report.minReserve)+' min');
  paragraph('Planned return: '+(Number.isFinite(report.reserveMin)?number(report.reserveMin,1)+' min of margin':'route review required'));
  paragraph('Position at export: '+report.position);
  if(Number.isFinite(report.extraLoadKg))paragraph('Extra equipment: '+number(report.extraLoadKg,1)+' kg in addition to the suit');
  if(report.weather){
    paragraph('Scenario weather - '+report.weather.area+': '+number(report.weather.temperatureC)+' °C | '+number(report.weather.windMps,1)+' m/s wind | '+report.weather.visibility,{size:9});
    paragraph('Weather is simulated for the selected area and mission clock; not live telemetry.',{size:8});
  }
  section('Walk stops');
  for(const stop of report.stops??[])paragraph((stop.completed?'Completed: ':'Pending: ')+stop.name+' - '+stop.duration+' min of observation');
  if(!report.stops?.length)paragraph('No stops selected.');
  if(report.track?.length>1){
    ensure(180);section('Route traveled');
    const top=y+6,height=95,w=PAGE_W-2*MARGIN;
    page.push(`0.96 0.97 0.98 rg ${MARGIN} ${PAGE_H-top-height} ${w} ${height} re f`);
    const points=report.track.map(([x,py])=>[MARGIN+12+x/1000*(w-24),PAGE_H-(top+8+py/750*(height-16))]);
    page.push(`${color(accent)} RG 1.8 w ${points.map(([x,py],i)=>`${x.toFixed(2)} ${py.toFixed(2)} ${i?'l':'m'}`).join(' ')} S`);
    const [x,py]=points.at(-1);page.push(`${color(accent)} rg ${(x-3).toFixed(2)} ${(py-3).toFixed(2)} 6 6 re f`);
    y=top+height+15;paragraph('Illustrative local diagram. The dot marks the position at export.',{size:8});
  }
  if(report.team?.length){
    section('Surface team');
    paragraph('Profiles have independent missions. Same-area tracks can be compared on the app map. All distances below are traveled distances.',{size:9});
    for(const profile of report.team){
      ensure(profile.track?.length>1&&profile.code!==report.profile?.code?250:110);
      section(profile.code+' - '+profile.name+' ('+profile.kind+')');
      paragraph(profile.sectorName+' | '+profile.status+' | '+number(profile.elapsedMin,1)+' mission min | '+number(profile.traveledM/1000,2)+' km traveled',{size:9,bold:true});
      paragraph('Extra equipment: '+number(profile.extraLoadKg??0,1)+' kg in addition to the suit',{size:9});
      if(profile.weather)paragraph('Scenario weather: '+number(profile.weather.temperatureC)+' °C | '+profile.weather.visibility,{size:9});
      if(profile.track?.length>1&&profile.code!==report.profile?.code)diagram([{points:profile.track,color:profile.color}],profile.code+' actual track. The square marks its last position.');
      decisions(profile.routeDecisions);
      if(profile.code!==report.profile?.code){
        for(const event of [...(profile.events??[])].reverse()){
          ensure(50);paragraph('T+'+number(event.scenarioTimeS/60,1)+' min - '+event.title,{size:9,bold:true});paragraph(event.details,{size:9});y+=5;
        }
      }
    }
  }else decisions(report.routeDecisions);
  const events=[...(report.events??[])].reverse();
  ensure(events.length?135:85);
  section('Session events and decisions');
  paragraph('Events include area changes and restarts; T+ refers to each walk.',{size:9});y+=8;
  if(!events.length)paragraph('No events recorded yet. The walk has not started.');
  for(const event of events){
    ensure(68);
    paragraph(`T+${number(event.scenarioTimeS/60,1)} min | ${String(event.sector).toUpperCase()} | ${dateText(event.time)}`,{size:8,ink:accent});
    paragraph(event.title,{size:11,bold:true});
    paragraph(event.details,{size:9});y+=10;
  }
  pages.push(page);
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const pageIds=[];
  pages.forEach((commands,index)=>{
    page=commands;
    line(MARGIN,PAGE_H-43,PAGE_W-MARGIN,PAGE_H-43);
    text('Mars Scouts | Mission report',MARGIN,PAGE_H-28,8);
    text(`${index+1} / ${pages.length}`,PAGE_W-MARGIN-40,PAGE_H-28,8);
    const stream=commands.join('\n'),id=objects.length;
    pageIds.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id+1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[2]=`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`;
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
  for(let id=1;id<objects.length;id++){offsets[id]=pdf.length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`;}
  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return bytes(pdf);
}
