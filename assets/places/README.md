# Place photographs

These local copies keep the place-facts view usable offline. Images have not been used as terrain or as evidence validating the scenario routes.

| File | Image and source | Credit |
| --- | --- | --- |
| wildcat.jpg | [PIA24928: Wildcat Ridge](https://www.jpl.nasa.gov/images/pia24928-sample-collection-and-rock-analysis-at-wildcat-ridge/) | NASA/JPL-Caltech/ASU/MSSS |
| skinner.jpg | [PIA24925: Skinner Ridge workspace](https://science.nasa.gov/photojournal/perseverance-workspace-at-skinner-ridge/) | NASA/JPL-Caltech/ASU/MSSS |
| jezero.jpg | [PIA24924: Jezero delta sampling locations](https://science.nasa.gov/photojournal/2-perseverance-sampling-locations-in-jezeros-delta/) | NASA/JPL-Caltech/ASU/MSSS |
| gale.jpg | [PIA26671, Figure A: Peace Vallis and Gale Crater's rim](https://science.nasa.gov/photojournal/curiosity-views-gale-craters-rim-homing-in-on-ancient-river-channel/) | NASA/JPL-Caltech/MSSS |
| gale-hollow.jpg | [Curiosity blog, Sols 4743–4749: Polygons in the Hollow](https://science.nasa.gov/blog/curiosity-blog-sols-4743-4749-polygons-in-the-hollow/) | NASA/JPL-Caltech/MSSS |
| gale-ridge.jpg | [PIA26558: Fractured boxwork ridge up close](https://www.jpl.nasa.gov/images/pia26558-curiosity-views-a-fractured-boxwork-pattern-up-close/) | NASA/JPL-Caltech/MSSS |
| gale-lookout.jpg | [PIA26560: Boxwork patterns at a distance](https://www.jpl.nasa.gov/images/pia26560-curiosity-views-boxwork-patterns-at-a-distance/) | NASA/JPL-Caltech/MSSS |
| jezero-junction.jpg | [PIA25212: Jezero's delta approach](https://science.nasa.gov/photojournal/jezero-craters-delta-is-getting-closer/) | NASA/JPL-Caltech/ASU/MSSS |
| jezero-crossing.jpg | [PIA24546: Santa Cruz hill in Jezero](https://science.nasa.gov/photojournal/mastcam-z-views-santa-cruz-on-mars/) | NASA/JPL-Caltech/ASU/MSSS |
| jezero-lookout.jpg | [PIA24921: Detailed Jezero delta panorama](https://science.nasa.gov/photojournal/detailed-panorama-of-mars-jezero-crater-delta/) | NASA/JPL-Caltech/ASU/MSSS |
| jezero-south.jpg | [PIA26373: Southward view up Jezero's rim](https://science.nasa.gov/photojournal/perseverance-rovers-view-up-crater/) | NASA/JPL-Caltech/ASU/MSSS |
| jezero-ridge.jpg | [PIA26378: Mid-climb view of Jezero](https://science.nasa.gov/photojournal/perseverances-mid-climb-view-of-jezero-crater/) | NASA/JPL-Caltech/ASU/MSSS |
| gale-junction.jpg | [PIA26693: Boxwork ridges and hollows](https://www.jpl.nasa.gov/images/pia26693-curiosity-surveys-the-boxwork-region/) | NASA/JPL-Caltech/MSSS |
| gale-crossing.jpg | [PIA26559: First 360-degree boxwork survey](https://www.jpl.nasa.gov/images/pia26559-curiositys-first-360-degree-view-of-boxwork-patterns/) | NASA/JPL-Caltech/MSSS |
| gale-south.jpg | [PIA26552: Road to boxwork, wind-carved valleys and Gould Mesa](https://www.jpl.nasa.gov/images/pia26552-curiosity-on-the-road-to-boxwork-formations/) | NASA/JPL-Caltech/MSSS |
| gale-corridor-ridge.jpg | [PIA26697: Mineral nodules in boxwork rock](https://www.jpl.nasa.gov/images/pia26697-curiosity-studies-nodules-on-boxwork-formations/) | NASA/JPL-Caltech/MSSS |

Every map point has an explicit photo assignment. All 16 points across both areas use different source photographs and different local image contents; there is no shared regional fallback. Unknown point IDs return no facts instead of reusing a photo. `tests/places.test.mjs` checks all assignments, source URLs, SHA-256 hashes and intrinsic JPEG dimensions, and the server test loads every assigned image over HTTP.

| Map point | Jezero photo | Gale photo |
| --- | --- | --- |
| Ares Base (simulated) | jezero.jpg | gale.jpg |
| Corridor junction (simulated) | jezero-junction.jpg | gale-junction.jpg |
| First observation | wildcat.jpg — Wildcat Ridge | gale-hollow.jpg — Valley hollow |
| Corridor crossing (simulated) | jezero-crossing.jpg | gale-crossing.jpg |
| Second observation | skinner.jpg — Skinner Ridge | gale-ridge.jpg — Monte Grande ridge |
| Lookout (simulated) | jezero-lookout.jpg — Delta lookout | gale-lookout.jpg — Boxwork lookout |
| Southern corridor (simulated) | jezero-south.jpg | gale-south.jpg |
| Ridge corridor (simulated) | jezero-ridge.jpg | gale-corridor-ridge.jpg |

Wildcat Ridge and Skinner Ridge use photographs of those actual places. The base, corridors, lookouts and Gale observation waypoints belong to the synthetic route graph. They use distinct real photographs from their corresponding crater as visual or geological references. Captions name the actual photographed feature and distinguish it from the simulated waypoint; no real photograph of a fictional base is claimed.

Skinner, Jezero and Gale use NASA's 2400-pixel derivatives with `fit=clip`, preserving the source proportions. Wildcat retains its 3225 × 2631 source. Gale uses NASA's Figure A (2400 × 900). Figure A is NASA's published detail view.

The narrow panoramas (`jezero-junction`, `jezero-lookout`, `jezero-south`, `jezero-ridge`, `gale-lookout` and `gale-crossing`) use 4000-pixel `fit=clip` derivatives to retain detail in their framed previews. `gale-south.jpg` uses the 5000-pixel derivative. `gale-junction.jpg` uses JPL's linked 1600-pixel JPEG derivative of PIA26693. `gale-hollow.jpg` retains NASA's 1632 × 1200 MAHLI photograph. All assets are downloaded source photographs, without generated scenery or fabricated detail.

The gallery shows a landscape detail from each source, using a separate display rectangle recorded in `photo-framing.mjs`. Those rectangles avoid the black mosaic gaps and give the previews a readable landscape shape. CSS positions the complete image behind that frame; the JPEG files themselves are not cropped or filled in. The 16 preview frames were reviewed together in the browser.

Clicking a photo or **View original photo** opens the complete local JPEG. Black areas in the originals are gaps in the rover mosaics. Tests verify that every display rectangle stays inside its source, has enough pixels for the card, and retains a usable landscape proportion, while continuing to verify that all 16 photographs are distinct.

Source image derivatives:

- [Jezero, 2400 pixels](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia24/pia24924/PIA24924.jpg?w=2400&fit=clip)
- [Skinner, 2400 pixels](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia24/pia24925/PIA24925.jpg?w=2400&fit=clip)
- [Gale Figure A, 2400 pixels](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia26/pia26671/figures/PIA26671_figA.jpg?w=2400&fit=clip)

Captions distinguish real photographs from synthetic local mission stops. The mission teams processed the images for visual contrast or lighting as described on the source pages.
