# Mars Scouts

Mars Scouts es una aplicación web de simulación para planificar y seguir caminatas de exploración en Marte. Permite elegir una zona, seleccionar puntos de observación, comparar rutas y acompañar el recorrido de un astronauta, teniendo en cuenta el tiempo disponible y el regreso a la base.

La app incluye los escenarios de **Jezero** y **Gale**, un mapa interactivo, un perfil de elevación, alertas de proximidad, condiciones meteorológicas simuladas y un historial de decisiones que se puede descargar en PDF.

## Cómo abrir la app

Necesitas **Node.js 20 o superior** y un navegador web. La aplicación no requiere instalar dependencias externas para ejecutarse.

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:

   ```powershell
   npm.cmd run dev
   ```

   También puedes usar `node server.mjs`. En Windows, otra opción es hacer doble clic en **start.cmd**.
3. Abre [http://localhost:3000](http://localhost:3000) en el navegador.
4. Mantén abierta la terminal mientras usas la app. Para detener el servidor, presiona **Ctrl+C**.

Abre la app desde esa dirección HTTP; abrir `index.html` directamente no permite cargar correctamente los módulos de JavaScript. Si el puerto 3000 está ocupado, consulta **Startup troubleshooting** más abajo.

## Guía de uso

La interfaz está en **inglés**. Esta guía conserva los nombres de los controles tal como aparecen en pantalla para que puedas identificarlos.

1. **Elige la zona de exploración.** Pulsa **Change area** y selecciona Jezero o Gale. En **View place facts** puedes consultar información, fotografías y fuentes sobre los lugares.
2. **Configura el tiempo disponible.** Abre **Settings** para ajustar la duración total de la misión. El cálculo del regreso contempla un margen fijo de 20 minutos.
3. **Selecciona las observaciones.** En **Edit walk stops**, elige uno o dos puntos de interés. Compara las rutas disponibles según su duración, distancia, ascenso y restricciones. La app recomienda una opción y tú eliges cuál seguir.
4. **Inicia la caminata.** Después de elegir una ruta, pulsa **Start walk**. El astronauta avanzará por el mapa y el perfil de elevación mostrará su posición. Puedes pausar y continuar con el mismo botón.
5. **Revisa el avance y las alertas.** Consulta el tiempo restante, la distancia y el margen de regreso. El panel **Explorer status** muestra lecturas fisiológicas simuladas. Las alertas escritas y de voz avisan de peligros cercanos; entrar en una zona de exclusión pausa la caminata.
6. **Ajusta el recorrido si cambian las condiciones.** Usa **Report load** para indicar equipo adicional, **Rest for 2 min** para descansar o **Adjust my walk** para probar cambios de movilidad y visibilidad. Cuando se proponga una nueva ruta, revísala y confírmala antes de continuar.
7. **Consulta y descarga el historial.** Abre **My history** y pulsa **Download mission report** para guardar un PDF con los recorridos y las decisiones registradas. Abrir el historial pausa la caminata.

### Otras funciones

| Control | Para qué sirve |
| --- | --- |
| **Return preview** | Compara regresar ahora con explorar unos minutos más antes de volver. La vista previa no modifica la misión. |
| **Terrain / Elevation** | Cambia la vista del mapa. También puedes ajustar las capas y el zoom. |
| **Sound and voice** | Activa o silencia la voz y los tonos de alerta. Las alertas escritas siguen disponibles. |
| **Simulate leaving the route** | Demuestra un desvío y busca una alternativa viable. Si hace falta retroceder, solicita volver a la ruta. |
| **Team** | Crea y cambia entre perfiles locales de astronautas, hasta un máximo de 12. Cada uno conserva su propia misión. |

### Guardado y alcance de la simulación

- Las misiones se guardan en el almacenamiento local del navegador cuando está disponible. Al recargar la página, la caminata se restaura en pausa. Borrar los datos del sitio elimina ese guardado; los perfiles no se sincronizan entre dispositivos.
- La caminata avanza en tiempo de misión acelerado. Pausarla detiene su reloj; un descanso explícito suma dos minutos a la misión.
- El terreno, las rutas, los peligros, el clima y las lecturas fisiológicas son simulados. El mapa local no carga cartografía de NASA Mars Trek y la demostración de desvíos no utiliza GPS real.
- Las fotografías de lugares y la generación de reportes PDF funcionan sin conexión a Internet mientras el servidor local esté disponible. Las fuentes tipográficas externas tienen alternativas del sistema.
- Mars Scouts es un proyecto independiente, sin respaldo de la NASA. Sus estimaciones son parte del escenario y no sustituyen herramientas de navegación EVA ni evaluaciones médicas.

---

La documentación técnica detallada se conserva a continuación en inglés.

Mars walk planning and tracking in English: routes, explorer activity, nearby hazards and return to base.

## Start

Requires Node.js 20 or later. There are no external runtime dependencies.

On Windows, double-click **start.cmd** in this folder, or run the following in PowerShell:

```powershell
npm.cmd run dev
```

You can also run `node server.mjs` directly. Open **http://localhost:3000** and keep the server terminal open. Stop your own instance with Ctrl+C. The server listens only on the local interface.

### Startup troubleshooting

- If PowerShell says that `npm.ps1` cannot run because script execution is disabled, use `npm.cmd run dev`, `node server.mjs` or `start.cmd`. No execution-policy change is needed. This machine had the `Restricted` policy when checked.
- If the browser cannot connect to localhost, start the server first. No server was responding on port 3000 during the initial investigation.
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

80 tests cover routes, restrictions, time buffers, mid-edge positions, physiology, proximity, playback and advance guidance. They also verify payload-dependent travel time, progressive deviations and warnings, genuine forward alternatives, dead-end and unmapped return requests, animated retracing, pause/reload continuity, sector-specific simulated weather, astronaut switching, retired rover removal and reports. HTTP tests verify the weather link is absent and load the page, stylesheet, local photographs and module graph.

Automated checks and HTTP delivery are verified. The computer-use tool blocked the latest Chrome reload because it could not determine the browser URL confidently; browser interaction and actual audio playback are not verified for this revision. A four-page PDF sample including extra equipment, local scenario weather and a missed-turn reroute was rendered and visually reviewed for readable layout and page breaks.

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
| places.mjs | Educational facts with NASA source links |
| assets/places/ | Offline place photographs, captions and source credits |
| echo.mjs | Future position and return comparison |
| server.mjs | Local static HTTP server |
| start.cmd | Windows launcher independent of npm.ps1 |
| tests/*.test.mjs | Node Test Runner tests |

Optional DM Sans and Manrope fonts load from Google Fonts; system fonts are used offline.
