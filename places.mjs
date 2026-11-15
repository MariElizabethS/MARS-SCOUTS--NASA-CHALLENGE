// Educational facts describe real craters; route coordinates remain scenario data.
import {photoFraming} from './photo-framing.mjs';
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
const galeCredit='NASA/JPL-Caltech/MSSS';
// Every map point has an explicit assignment. Never reuse a sector-wide fallback.
const placePhotos={
  jezero:{base:'jezero',junction:'jezeroJunction',wildcat:'wildcat',crossing:'jezeroCrossing',skinner:'skinner',lookout:'jezeroLookout',south:'jezeroSouth',ridge:'jezeroRidge'},
  gale:{base:'gale',junction:'galeJunction',wildcat:'galeHollow',crossing:'galeCrossing',skinner:'galeRidge',lookout:'galeLookout',south:'galeSouth',ridge:'galeCorridorRidge'}
};
const photoCatalog={
  jezero:{src:'assets/places/jezero.jpg',alt:'Rocky delta outcrops at Wildcat Ridge and Skinner Ridge in Jezero Crater',caption:'A real Perseverance panorama of the two sampling areas in Jezero’s delta. Colors enhanced by the mission team.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/2-perseverance-sampling-locations-in-jezeros-delta/'},
  wildcat:{src:'assets/places/wildcat.jpg',alt:'Wildcat Ridge with sample drill holes and an abrasion patch',caption:'Wildcat Ridge, photographed by Perseverance. Drill holes and a prepared abrasion patch mark the sampling workspace.',credit:nasaCredit,source:'https://www.jpl.nasa.gov/images/pia24928-sample-collection-and-rock-analysis-at-wildcat-ridge/'},
  skinner:{src:'assets/places/skinner.jpg',alt:'Layered rocks and rover arm at the Skinner Ridge workspace',caption:'Perseverance’s workspace at Skinner Ridge, with exposed layers in the delta rock.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/perseverance-workspace-at-skinner-ridge/'},
  gale:{src:'assets/places/gale.jpg',alt:'Curiosity view of Peace Vallis and the northern rim of Gale Crater',caption:'NASA’s detail view of Peace Vallis and Gale Crater’s northern rim (Figure A). This is regional context; the local route stops are scenario locations.',credit:galeCredit,source:'https://science.nasa.gov/photojournal/curiosity-views-gale-craters-rim-homing-in-on-ancient-river-channel/'},
  galeHollow:{src:'assets/places/gale-hollow.jpg',alt:'Close-up of polygon-shaped rock textures in the Monte Grande boxwork hollow',caption:'Curiosity’s close-up of polygon-shaped rock textures in the Monte Grande hollow. A geological reference for the scenario’s Valley hollow stop; the route position is simulated.',credit:galeCredit,source:'https://science.nasa.gov/blog/curiosity-blog-sols-4743-4749-polygons-in-the-hollow/'},
  galeRidge:{src:'assets/places/gale-ridge.jpg',alt:'A fractured boxwork ridge photographed up close by Curiosity',caption:'A fractured boxwork ridge photographed by Curiosity. A geological reference for the scenario’s Monte Grande ridge stop, not a verified photograph of that simulated waypoint.',credit:galeCredit,source:'https://www.jpl.nasa.gov/images/pia26558-curiosity-views-a-fractured-boxwork-pattern-up-close/'},
  galeLookout:{src:'assets/places/gale-lookout.jpg',alt:'Distant view across low boxwork ridges in the foothills of Mount Sharp',caption:'Curiosity’s distant view across boxwork formations. A landscape reference for the scenario’s Boxwork lookout; the simulated viewpoint has not been validated.',credit:galeCredit,source:'https://www.jpl.nasa.gov/images/pia26560-curiosity-views-boxwork-patterns-at-a-distance/'},
  jezeroJunction:{src:'assets/places/jezero-junction.jpg',alt:'Perseverance approaching the ancient delta front in Jezero Crater',caption:'The delta front seen by Perseverance during its approach. A real Jezero landscape used as a reference for the simulated corridor junction.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/jezero-craters-delta-is-getting-closer/'},
  jezeroCrossing:{src:'assets/places/jezero-crossing.jpg',alt:'Santa Cruz hill beyond a rocky plain inside Jezero Crater',caption:'Santa Cruz hill and the rocky floor of Jezero Crater, photographed by Perseverance. A landscape reference for the simulated corridor crossing.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/mastcam-z-views-santa-cruz-on-mars/'},
  jezeroLookout:{src:'assets/places/jezero-lookout.jpg',alt:'Detailed Perseverance panorama of layered rocks in the Jezero delta',caption:'Perseverance’s detailed panorama of Jezero’s delta. A real view of delta geology used for the simulated Delta lookout; its exact viewpoint is not validated.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/detailed-panorama-of-mars-jezero-crater-delta/'},
  jezeroSouth:{src:'assets/places/jezero-south.jpg',alt:'Perseverance looking south toward hills on the rim of Jezero Crater',caption:'Perseverance’s southward view toward Jezero’s crater rim. A landscape reference for the simulated southern corridor.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/perseverance-rovers-view-up-crater/'},
  jezeroRidge:{src:'assets/places/jezero-ridge.jpg',alt:'View across Jezero Crater from Perseverance’s climb up the western wall',caption:'Jezero Crater seen during Perseverance’s climb up its western wall. A landscape reference for the simulated ridge corridor.',credit:nasaCredit,source:'https://science.nasa.gov/photojournal/perseverances-mid-climb-view-of-jezero-crater/'},
  galeJunction:{src:'assets/places/gale-junction.jpg',alt:'Low boxwork ridges and sandy hollows surveyed by Curiosity on Mount Sharp',caption:'Curiosity’s survey of boxwork ridges and hollows on Mount Sharp. A real Gale landscape used as a reference for the simulated corridor junction.',credit:galeCredit,source:'https://www.jpl.nasa.gov/images/pia26693-curiosity-surveys-the-boxwork-region/'},
  galeCrossing:{src:'assets/places/gale-crossing.jpg',alt:'Curiosity’s first panoramic survey after arriving among boxwork formations',caption:'Curiosity’s first 360-degree survey of the boxwork region. A landscape reference for the simulated corridor crossing.',credit:galeCredit,source:'https://www.jpl.nasa.gov/images/pia26559-curiositys-first-360-degree-view-of-boxwork-patterns/'},
  galeSouth:{src:'assets/places/gale-south.jpg',alt:'Wind-carved valleys and Gould Mesa on Curiosity’s approach to boxwork formations',caption:'Wind-carved valleys and Gould Mesa on Curiosity’s approach to the boxwork region. A landscape reference for the simulated southern corridor.',credit:galeCredit,source:'https://www.jpl.nasa.gov/images/pia26552-curiosity-on-the-road-to-boxwork-formations/'},
  galeCorridorRidge:{src:'assets/places/gale-corridor-ridge.jpg',alt:'Mineral nodules on boxwork rock photographed by Curiosity’s arm camera',caption:'Mineral nodules in the boxwork region, photographed by Curiosity’s MAHLI camera. A geological reference for the simulated ridge corridor.',credit:galeCredit,source:'https://www.jpl.nasa.gov/images/pia26697-curiosity-studies-nodules-on-boxwork-formations/'}
};
export function placeFacts(sector,id){
  const assignments=placePhotos[sector];
  if(!assignments||!Object.hasOwn(assignments,id))return null;
  const info=factsFor(sector,id);if(!info)return null;
  const photoId=assignments[id];
  const photo=photoCatalog[photoId],frame=photoFraming[photo.src.split('/').at(-1)];
  return {...info,photos:[{...photo,...frame}]};
}
