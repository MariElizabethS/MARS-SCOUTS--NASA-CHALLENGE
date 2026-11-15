# Mars Scouts · Technical reference

[← Volver a la presentación del proyecto](../README.md)

Detailed behavior, models and source references. This document is maintained in English, matching the app interface.

## Start

Requires Node.js 20 or later. There are no external runtime dependencies.

On Windows, double-click **start.cmd** in this folder, or run the following in PowerShell:

```powershell
npm.cmd run dev
```

You can also run `node server.mjs` directly. Open **http://localhost:3000** and keep the server terminal open. Stop your own instance with Ctrl+C. The server listens only on the local interface.

### Startup troubleshooting

- If PowerShell says that `npm.ps1` cannot run because script execution is disabled, use `npm.cmd run dev`, `node server.mjs` or `start.cmd`. No execution-policy change is needed.
- If the browser cannot connect to localhost, start the server first.
- Open the HTTP address printed by the server. Opening `index.html` directly as a file does not provide the HTTP environment needed by the JavaScript modules.
- If the port is already in use, the server prints a clear message. Open the existing instance if it is Mars Scouts, or select another port with `$env:PORT=3001` followed by `node server.mjs` in PowerShell.
- If the page was already open, refresh it after updates.

## Interface

1. **Change area** selects Jezero or Gale, then opens the observation choices. Jezero uses a near-black violet background, muted purple panels and light text; Gale retains its warm orange accent. **View place facts** includes locally stored NASA photographs, captions, credits and source links. Gale photos provide regional context for fictional scenario stops.
2. **Edit walk stops** chooses one or two observations, then compares up to three routes. Purple, teal and amber distinguish the options. Each card shows time, distance, total climb and a short explanation; expandable details describe the waypoints, observations and proximity hazards. The recommendation minimizes feasible total mission time, including observations and return. The explorer explicitly chooses the plan. Conditions can limit the available options or require a fallback observation or direct return.
3. **Choose a route**, then **Start walk**. The selected corridor sequence drives the actual playback and its color appears on the main map. The same control pauses or resumes. The compact route summary reopens comparison; canceling a comparison preserves the existing selection. Zoom, drag while enlarged and switch layers or elevation views.
4. **Explorer status** displays synthetic readings. **Report load** records 0-80 kg of equipment or samples in addition to the suit. A preview shows the estimated pace, remaining mission time and any time-buffer risk. Reporting pauses the walk at its actual position and requires reviewing revised routes. **Rest for 2 min** consumes two mission minutes and shows traveled distance, mission time, completed observations and a direct-return estimate. Position and distance are preserved.
5. **Adjust my walk** explains each change before applying it: walk more slowly in Jezero, avoid the ridge in Gale, report poor visibility or start over. The walk pauses for review of any proposal. Changes are calculated from the current position.
6. **My history** pauses the walk. **Download mission report** exports each astronaut, actual tracks, compared routes, recommendations, selected alternatives, reported equipment, scenario weather, missed-turn reroutes and checkpoint events. PDF downloads and place photographs work offline.
7. **Team** adds astronauts with unique codes and call signs (up to 12 profiles). The circles at the bottom of the side panel also switch profiles. Switching pauses the current astronaut and restores the other mission independently, including reported equipment. Same-area tracks remain visible together. Browser storage preserves missions between reloads; playback reloads paused. Codes identify local profiles without cross-device accounts. The retired rover type is no longer available; loading older saved data removes rover entries while retaining astronaut missions.
8. **Settings** contains only total mission time. The former editable reserve field is removed. The engine retains a fixed 20-minute time buffer for return calculations; this is not an oxygen quantity.
9. **Local weather** shares one slightly lighter summary bar with the objective, remaining distance, estimated time and return margin. All weather fields remain visible: area, local mission clock, temperature in Celsius, conditions, wind, visibility and the simulation label. The shared bar wraps within the same surface on smaller screens. Weather values are simulated rather than current NASA measurements or an Earth-date forecast. Reporting poor visibility updates the dust scenario and observation restrictions.
10. **Simulate leaving the route**, directly below **What does the map show?**, visibly animates the astronaut away from the selected route, using a side corridor where one exists. Distance and mission time accumulate during movement. An on-map warning appears while the astronaut is leaving; a pink trace shows the deviation. A genuine alternative continues forward and retains the remaining observations within the time buffer, and appears automatically in teal. A U-turn or an itinerary that drops stops is not an alternative. If none exists, navigation stops, an amber line points back, and **Return to your route** requests the return. Confirming animates the astronaut retracing the track. Even on the final corridor without a junction, the demo can leave the mapped line; this only permits returning to the last known route position, without inventing an unmapped connection. Pausing, switching profiles and reloading preserve the actual position. This is a navigation demo rather than live GPS detection.

**Route elevation** starts expanded below the walk controls. Its marker follows the explorer between waypoints, highlights the traveled segment and updates current elevation and remaining distance. The curve stays stable between segments; a revised route begins at the actual position. The marker remains mounted during updates so its double halo and soft pulse stay continuous. Reduced-motion mode uses a static glow.

**Return and alerts** follows the elevation panel and groups explanations and voice controls. It opens automatically for a proposal or an infeasible return. **Adjust my walk** sits below the main workspace. On desktop the map stays visible while reading the side panel.

Pausing playback freezes the mission clock. An explicit rest adds mission time. Normal playback represents 15 mission seconds per real second, eight times slower than the earlier rate. Near hazards or during guidance this drops to 4.8 mission seconds per real second. These values affect playback, not the operating speed used by the route engine. Turn guidance is prepared about 14 real seconds before a junction or stop. Hiding the tab pauses the walk to prevent jumps on return. Observation activities are counted on arrival at each stop.

The top bar changes background with the area. Surfaces separate panels and buttons, with visible keyboard focus. The area-selector planet rotates in 10 seconds and the alert planet in 5 seconds; reduced-motion mode disables both. Jezero notices and button states use the purple palette. The walk control has one state icon.

**Return preview** asks **When should I turn back?** The slider sets 0-20 mission minutes of additional exploration. Two numbered choices compare going home now with continuing first; values explicitly state time to base and time left on arrival. A ghost marker shows the future turn-back point and a dashed line its direct return. Projection follows the selected route, while return estimates use the quickest way home. It includes slope, reported equipment, walking pace, closures, mid-edge positions and observation time. It does not alter the live mission or pause playback.

All interface text, accessible labels, scenario descriptions, facts, logs and generated PDF labels are in English. Browser speech requests the en-US language. Voice availability depends on the browser and installed voices. PDF timestamps use English formatting with the America/Guayaquil time zone.

## Physiological model

Readings **do not come from a sensor**. The panel retains readings and two discreet NASA EVA reference links. The former model-and-references box, heart icon and visible synthetic-data label have been removed; the explanation remains here.

The fictional individual has a resting heart rate of 74 bpm, respiration of 14 breaths/min and initial SpO2 of 98.1%. Coefficients are product assumptions, not personal measurements from Mars or a validated clinical regression.

- Speed, uphill slope and surface roughness increase relative workload.
- Heart rate and respiration approach effort targets gradually rather than jumping randomly.
- Modeled fatigue accumulates during activity and falls during explicit rest.
- Observations use lower stationary workload than walking.
- Suit respiratory support is assumed. Blood oxygen saturation varies slightly within a configured range and is not derived from the outside Martian atmosphere. SpO2, suit pressure and available suit oxygen are separate variables.
- Lower gravity is not a linear heart-rate multiplier; suit load and terrain make that simplification unjustified.
- Readings do not diagnose, issue clinical alarms or independently alter navigation constraints. The user or mission event changes the operating profile.

Qualitative references:

- [NASA NTRS: Improving Metabolic Workload Estimation Accuracy for Planning and Analyzing Exploration Traverses](https://ntrs.nasa.gov/citations/20240001423): effort variables such as speed, slope, surface and load.
- [NASA NTRS: EVA Metabolic Rate Estimated from Heart Rate](https://ntrs.nasa.gov/citations/20210024317): a studied relationship between heart rate and metabolic demand; this does not validate the Mars Scouts model.

## Proximity alerts

Voice provides guidance on departure and before a junction or stop. Hazards take priority. **Sound and voice** controls both speech and alarm tones. Starting a walk or enabling the switch unlocks audio; browser playback restrictions still apply.

- Outside the warning perimeter: no proximity alarm.
- Within 180 meters of the perimeter: a notification with a small animated planet, alarm tones and spoken explanation appears when sound is enabled. Playback slows to allow a response. Animation respects reduced motion.
- Caution notices disappear after 14 seconds or when leaving range. Playback stays slower while the hazard remains nearby.
- Entering a caution area updates the notice.
- Entering an exclusion pauses the walk.
- Leaving range removes the notice and cancels an automatic announcement still playing.
- An active phase is not repeated on each update. Approaching again after leaving produces a fresh warning.

Monitoring continues when the hazards layer is hidden. The Gale closure adds the ridge perimeter to active hazards. Resting, changing visibility or recalculating a route does not itself trigger a hazard alarm. **Listen to explanation** remains available on request.

Each proximity warning names the hazard and explains its terrain risk: loose ground and rocks, a steep slope with unstable footing, or a closed ridge passage. **Find a safer route** pauses at the actual position and opens route comparison with all marked danger zones excluded. Every segment is checked against the circular perimeter, including virtual segments at mid-corridor positions. Merely keeping both endpoint nodes outside the circle is insufficient.

The comparison first tries to retain all requested observations, then reachable subsets, a lookout where available, or a direct return. Cards name any omitted stops. In the current graph, the slope circle intersects the only corridor into Skinner Ridge / Monte Grande ridge, so avoiding it makes that observation unavailable. If no mapped safe route fits the time buffer, the app explains this and stays paused. Avoidance persists with each astronaut's mission, applies to the return preview and navigation demo, and is cleared when restarting the scenario.

Map labels retain the full observation names on compact screens instead of replacing them with “Stop 1” or “Stop 2”.

Voice uses browser speech synthesis without a microphone or external model. Written alerts work when speech is unavailable. Proximity parameters are scenario rules, not validated EVA operating distances.

## Map and Mars Trek

The interface references [NASA Mars Trek](https://trek.nasa.gov/mars/) for layers, elevation, scale, metadata and routes, with links to the viewer and its [tools and products](https://trek.nasa.gov/mars/jpl/config/textAbout.html).

**The local map does not load Mars Trek tiles or GeoTIFF files.** Code generates the terrain; corridors, elevations and hazards are synthetic. This is not a verified NASA mapping integration. The former cartographic footer, illustrative-view label, point-tapping instructions and footer references button were removed. **What does the map show?** explains the scope. Both areas share a test graph with different context, names and constraints. The base is fixed. Alternative science views require validation and do not count as confirmed science.

The route engine uses Dijkstra over 8 nodes and 11 corridors with directional slope costs. Route comparison enumerates simple paths, considers both stop orders and filters by time and exclusions. Baseline walking speeds are 45 m/min normally and 14 m/min at reduced pace. Extra equipment changes pace to baseline / (1 + 0.02 x extra kilograms); observation durations remain unchanged. These coefficients and the 0-80 kg reporting range are product assumptions, not validated EVA carrying limits. Extra load also increases synthetic workload. Time-buffer warnings concern the scenario, not medical or suit-oxygen alarms. A temporary node preserves the actual position before pace changes and reroutes.

Mars Scouts is independent, has no NASA endorsement and does not replace operational EVA navigation tools.

## Verification

```powershell
npm.cmd test
```

Tests cover routes, restrictions, time buffers, mid-edge positions, physiology, proximity, playback and advance guidance. They also verify payload-dependent travel time, progressive deviations and warnings, genuine forward alternatives, dead-end and unmapped return requests, animated retracing, pause/reload continuity, sector-specific simulated weather, astronaut switching, retired rover removal and reports. HTTP tests verify the weather link is absent and load the page, stylesheet, local photographs and module graph.


## Files

| File | Purpose |
| --- | --- |
| index.html, styles.css | Responsive, accessible interface |
| app.js | Walk playback, panels, speech and exports |
| engine.mjs | Routes and reserves |
| route-planner.mjs | Alternative corridors, recommendation metrics and route colors |
| profile-registry.mjs | Local profile registration and persistence |
| conditions.mjs | Extra-load pace factor and simulated weather by sector |
| navigation.mjs | Mapped missed-turn simulation with distance and time accounting |
| physiology.mjs | Deterministic synthetic readings |
| safety.mjs | Hazards and proximity transitions |
| playback.mjs | Playback pace and advance guidance |
| history-pdf.mjs | Locally generated printable history PDF |
| elevation.mjs | Elevation profile and interpolation |
| places.mjs | Educational facts and unique photo assignments |
| photo-framing.mjs | Individual landscape preview frames |
| assets/places/ | Offline place photographs, captions and source credits |
| echo.mjs | Future position and return comparison |
| server.mjs | Local static HTTP server |
| start.cmd | Windows launcher independent of npm.ps1 |
| tests/*.test.mjs | Node Test Runner tests |

Optional DM Sans and Manrope fonts load from Google Fonts; system fonts are used offline.

