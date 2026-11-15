// Educational facts describe real craters; route coordinates remain scenario data.
const deltaSource='https://science.nasa.gov/resource/two-perseverance-sampling-locations-in-jezeros-delta/';
const abrasionSource='https://science.nasa.gov/resource/two-abrasion-patches-from-perseverance-at-jezero-delta/';
const galeSource='https://science.nasa.gov/resource/now-and-long-ago-at-gale-crater-mars/';
const jezeroFacts=[
  {title:'A delta preserves clues to the past',text:'Sedimentary rocks in the Jezero delta are of interest in the search for possible signs of ancient microbial life.',source:deltaSource},
  {title:'Two places visited by Perseverance',text:'Wildcat Ridge and Skinner Ridge are real places where Perseverance collected rock samples in the Jezero delta.',source:deltaSource}
];
const galeFacts=[
  {title:'A landscape that once held lakes',text:'Gale rocks preserve evidence of ancient lakes and environments that changed over time.',source:galeSource},
  {title:'A mountain that holds a story',text:'Curiosity investigates layers on the floor of Gale and its central mountain, Mount Sharp, to reconstruct ancient environments.',source:galeSource}
];
function factsFor(sector,id){
  if(sector==='gale')return {scope:'About Gale Crater',facts:galeFacts};
  if(sector!=='jezero')return null;
  if(id==='skinner')return {scope:'About Skinner Ridge',facts:[
    {title:'Looking beneath the surface',text:'Perseverance created abrasion patches at Skinner Ridge and Wildcat Ridge. These surfaces allowed a close look at two types of delta rock.',source:abrasionSource},jezeroFacts[1]
  ]};
  if(id==='wildcat')return {scope:'About Wildcat Ridge',facts:[jezeroFacts[1],jezeroFacts[0]]};
  return {scope:'About Jezero Crater',facts:jezeroFacts};
}

const nasaCredit='NASA/JPL-Caltech/ASU/MSSS';
const photoCatalog={
  jezero:{src:'assets/places/jezero.jpg',alt:'Rocky delta outcrops at Wildcat Ridge and Skinner Ridge in Jezero Crater',caption:'A real Perseverance panorama of the two sampling areas in Jezero’s delta. Colors enhanced by the mission team.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/2-perseverance-sampling-locations-in-jezeros-delta/'},
  wildcat:{src:'assets/places/wildcat.jpg',alt:'Wildcat Ridge with sample drill holes and an abrasion patch',caption:'Wildcat Ridge, photographed by Perseverance. Drill holes and a prepared abrasion patch mark the sampling workspace.',credit:nasaCredit,source:'https://www.jpl.nasa.gov/images/pia24928-sample-collection-and-rock-analysis-at-wildcat-ridge/'},
  skinner:{src:'assets/places/skinner.jpg',alt:'Layered rocks and rover arm at the Skinner Ridge workspace',caption:'Perseverance’s workspace at Skinner Ridge, with exposed layers in the delta rock.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/perseverance-workspace-at-skinner-ridge/'},
  gale:{src:'assets/places/gale.jpg',alt:'Curiosity panorama looking across Gale Crater toward its northern rim',caption:'A real Curiosity panorama across Gale Crater. This is regional context; the local route stops are scenario locations.',credit:'NASA/JPL-Caltech/MSSS',source:'https://science.nasa.gov/photojournal/curiosity-views-gale-craters-rim-homing-in-on-ancient-river-channel/'}
};
export function placeFacts(sector,id){
  const info=factsFor(sector,id);if(!info)return null;
  return {...info,photos:[sector==='gale'?photoCatalog.gale:photoCatalog[id]||photoCatalog.jezero]};
}
